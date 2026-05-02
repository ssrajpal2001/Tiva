import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Platform, ActivityIndicator, Alert, Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";
import { useProgress } from "@/contexts/ProgressContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUri?: string;
  timestamp: string;
}

const MODE_LABELS: Record<string, string> = {
  ask: "Ask Anything",
  homework: "Homework",
  "exam-prep": "Exam Prep",
  revision: "Revision",
};

const MODE_COLORS: Record<string, string> = {
  ask: "#4361ee",
  homework: "#7209b7",
  "exam-prep": "#f72585",
  revision: "#f77f00",
};

const VOICE_PITCH: Record<string, number> = {
  friendly: 1.1,
  strict: 0.9,
  motivational: 1.2,
};

const VOICE_RATE: Record<string, number> = {
  friendly: 0.9,
  strict: 0.85,
  motivational: 1.0,
};

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <View style={[typingStyles.container, { backgroundColor: color + "18", borderColor: color + "30" }]}>
      <View style={[typingStyles.dot, { backgroundColor: color }]} />
      <View style={[typingStyles.dot, { backgroundColor: color }]} />
      <View style={[typingStyles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: {
    flexDirection: "row", gap: 5, padding: 14, borderRadius: 18,
    alignSelf: "flex-start", borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, opacity: 0.7 },
});

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { awardXp } = useProgress();

  const params = useLocalSearchParams<{
    sessionId: string;
    subject: string;
    mode: string;
    grade: string;
    board: string;
  }>();

  const { sessionId, subject, mode, grade, board } = params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const inputRef = useRef<TextInput>(null);
  const messageSentAtRef = useRef<number | null>(null);

  const modeColor = MODE_COLORS[mode ?? "ask"] ?? colors.primary;
  const modeLabel = MODE_LABELS[mode ?? "ask"] ?? "Ask";
  const voicePersonality = profile?.voicePersonality ?? "friendly";

  useEffect(() => {
    const loadHistory = async () => {
      if (!sessionId || !profile?.deviceId) { setHistoryLoading(false); return; }
      try {
        const response = await fetch(
          `${getBaseUrl()}/api/tutor/sessions/${sessionId}?deviceId=${encodeURIComponent(profile.deviceId)}`
        );
        if (response.ok) {
          const data = await response.json();
          const serverMessages: Message[] = (data.messages ?? []).map(
            (m: { id: number; role: string; content: string; createdAt: string }) => ({
              id: m.id.toString(),
              role: m.role as "user" | "assistant",
              content: m.content,
              timestamp: m.createdAt,
            })
          );
          setMessages(serverMessages.reverse());
        }
      } catch {
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [sessionId, profile?.deviceId]);

  const speakText = useCallback(async (text: string) => {
    if (Platform.OS === "web") return;
    try {
      const speaking = await Speech.isSpeakingAsync();
      if (speaking) {
        await Speech.stop();
      }
      const cleanText = text.replace(/[*#_`]/g, "").replace(/^TOPIC:.*$/m, "").substring(0, 500);
      setIsSpeaking(true);
      Speech.speak(cleanText, {
        language: "en-IN",
        pitch: VOICE_PITCH[voicePersonality] ?? 1.0,
        rate: VOICE_RATE[voicePersonality] ?? 0.9,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  }, [voicePersonality]);

  const stopSpeaking = useCallback(async () => {
    try {
      await Speech.stop();
      setIsSpeaking(false);
    } catch {}
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (isRecording || isSending) return;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Microphone access is needed for voice input");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      setIsRecording(false);
    }
  }, [isRecording, isSending]);

  const stopVoiceRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsTranscribing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      const base64Response = await fetch(uri);
      const blob = await base64Response.blob();
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const transcribeResponse = await fetch(`${getBaseUrl()}/api/tutor/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/m4a" }),
      });

      if (transcribeResponse.ok) {
        const { text } = await transcribeResponse.json();
        if (text?.trim()) {
          setInput(text.trim());
          inputRef.current?.focus();
        }
      }
    } catch {
      Alert.alert("Voice Error", "Could not transcribe audio. Please type your question.");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const { refreshFromBackend } = useProgress();

  const awardXpWithBackend = useCallback(async (xpAmount: number, subjectName: string, timeMinutes: number) => {
    awardXp(xpAmount, subjectName, timeMinutes);
    const deviceId = profile?.deviceId;
    if (!deviceId) return;
    try {
      await fetch(`${getBaseUrl()}/api/progress/${encodeURIComponent(deviceId)}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp: xpAmount, subject: subjectName, reason: "chat_message", timeMinutes }),
      });
      await refreshFromBackend(deviceId);
    } catch {
    }
  }, [awardXp, profile?.deviceId, refreshFromBackend]);

  const sendMessage = useCallback(async (content: string, imageBase64?: string) => {
    if (!content.trim() && !imageBase64) return;
    if (isSending) return;

    const userMessage: Message = {
      id: Date.now().toString() + "u",
      role: "user",
      content: imageBase64 ? (content || "[Scanning image question...]") : content,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [userMessage, ...prev]);
    setInput("");
    setIsSending(true);
    setStreamingContent("");
    messageSentAtRef.current = Date.now();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const endpoint = imageBase64
        ? `${getBaseUrl()}/api/tutor/sessions/${sessionId}/image-messages`
        : `${getBaseUrl()}/api/tutor/sessions/${sessionId}/messages`;

      const body = imageBase64
        ? { imageBase64, grade, board, subject, mode, deviceId: profile?.deviceId ?? "" }
        : { content, grade, board, subject, mode, deviceId: profile?.deviceId ?? "" };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let sseBuffer = "";

      const handleSseEvent = async (eventData: string) => {
        const trimmed = eventData.trim();
        if (!trimmed) return;
        let data: { content?: string; done?: boolean; extractedQuestion?: string };
        try {
          data = JSON.parse(trimmed) as typeof data;
        } catch {
          return;
        }
        if (data.content) {
          accumulated += data.content;
          setStreamingContent(accumulated);
        }
        if (data.done) {
          if (data.extractedQuestion) {
            setMessages((prev) => {
              const updated = [...prev];
              const firstUserIdx = updated.findIndex((m) => m.role === "user");
              if (firstUserIdx >= 0 && updated[firstUserIdx]) {
                updated[firstUserIdx] = {
                  ...updated[firstUserIdx]!,
                  content: `[Image] ${data.extractedQuestion}`,
                };
              }
              return updated;
            });
          }
          const cleanResponse = accumulated.replace(/^TOPIC:.*$/m, "").trim();
          const assistantMessage: Message = {
            id: Date.now().toString() + "a",
            role: "assistant",
            content: cleanResponse,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [assistantMessage, ...prev]);
          setStreamingContent("");
          const elapsedMs = messageSentAtRef.current ? Date.now() - messageSentAtRef.current : 0;
          const elapsedMinutes = Math.max(Math.round(elapsedMs / 60000), 1);
          messageSentAtRef.current = null;
          await awardXpWithBackend(10, subject ?? "General", elapsedMinutes);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          speakText(cleanResponse);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        const events = sseBuffer.split("\n\n");
        sseBuffer = events.pop() ?? "";

        for (const event of events) {
          for (const line of event.split("\n")) {
            if (line.startsWith("data: ")) {
              await handleSseEvent(line.slice(6));
            }
          }
        }
      }

      if (sseBuffer.trim()) {
        for (const line of sseBuffer.split("\n")) {
          if (line.startsWith("data: ")) {
            await handleSseEvent(line.slice(6));
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      const errMessage: Message = {
        id: Date.now().toString() + "e",
        role: "assistant",
        content: `I had trouble connecting. ${errMsg}. Please check your connection and try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [errMessage, ...prev]);
    } finally {
      setIsSending(false);
      setStreamingContent("");
    }
  }, [isSending, sessionId, grade, board, subject, mode, profile, awardXpWithBackend, speakText]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to photos to scan questions");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await sendMessage("", result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to scan questions");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await sendMessage("", result.assets[0].base64);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser && (
          <View style={[styles.avatarDot, { backgroundColor: modeColor }]}>
            <Ionicons name="sparkles" size={12} color="#fff" />
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
          onLongPress={() => !isUser && speakText(item.content)}
          activeOpacity={0.95}
        >
          {item.imageUri && (
            <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />
          )}
          <Text
            style={[
              styles.messageText,
              {
                color: isUser ? colors.primaryForeground : colors.foreground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            {item.content}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const streamingMessage = streamingContent ? (
    <View style={[styles.messageRow, styles.assistantRow]}>
      <View style={[styles.avatarDot, { backgroundColor: modeColor }]}>
        <Ionicons name="sparkles" size={12} color="#fff" />
      </View>
      <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.messageText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
          {streamingContent}
        </Text>
      </View>
    </View>
  ) : isSending && messages.length > 0 && messages[0]?.role === "user" ? (
    <View style={[styles.messageRow, styles.assistantRow]}>
      <View style={[styles.avatarDot, { backgroundColor: modeColor }]}>
        <Ionicons name="sparkles" size={12} color="#fff" />
      </View>
      <TypingIndicator color={modeColor} />
    </View>
  ) : null;

  const voiceButtonColor = isRecording ? "#ef4444" : isTranscribing ? colors.warning : colors.mutedForeground;
  const voiceButtonIcon: "mic" | "mic-off" | "hourglass" = isRecording ? "mic-off" : isTranscribing ? "hourglass" : "mic";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.chatHeader, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => { stopSpeaking(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.subjectLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
            {subject}
          </Text>
          <View style={[styles.modeTag, { backgroundColor: modeColor + "20" }]}>
            <Text style={[styles.modeTagText, { color: modeColor, fontFamily: "Inter_500Medium" }]}>{modeLabel}</Text>
          </View>
        </View>
        {isSpeaking ? (
          <TouchableOpacity onPress={stopSpeaking} style={styles.headerBtn}>
            <Ionicons name="volume-mute" size={22} color={modeColor} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {historyLoading ? (
        <View style={styles.historyLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <>
          {messages.length === 0 && !isSending && (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: modeColor + "20" }]}>
                <Ionicons name="sparkles" size={32} color={modeColor} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {grade} · {board} · {subject}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Type, speak, or photograph your question
              </Text>
              {Platform.OS !== "web" && (
                <Text style={[styles.emptyHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Long-press any response to hear it read aloud
                </Text>
              )}
            </View>
          )}

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              inverted
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 16, paddingTop: 16 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              scrollEnabled={messages.length > 0}
              ListHeaderComponent={streamingMessage}
            />

            <View style={[styles.inputContainer, { paddingBottom: bottomPad + 8, borderTopColor: colors.border, backgroundColor: colors.background }]}>
              {Platform.OS !== "web" && (
                <TouchableOpacity
                  style={[styles.imageBtn, isRecording && styles.recordingActive]}
                  onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
                  disabled={isTranscribing || isSending}
                  testID="voice-btn"
                >
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color={colors.warning} />
                  ) : (
                    <Ionicons name={voiceButtonIcon} size={22} color={voiceButtonColor} />
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.imageBtn} onPress={takePhoto} testID="camera-btn">
                <Ionicons name="camera" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage} testID="gallery-btn">
                <Ionicons name="image" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: isRecording ? "#ef4444" : colors.border, fontFamily: "Inter_400Regular" }]}
                placeholder={isRecording ? "Recording... tap mic to stop" : "Ask your question..."}
                placeholderTextColor={isRecording ? "#ef4444" : colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={1000}
                testID="message-input"
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]}
                onPress={() => sendMessage(input)}
                disabled={!input.trim() || isSending}
                testID="send-btn"
              >
                {isSending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={18} color={input.trim() ? "#fff" : colors.mutedForeground} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  backBtn: { width: 40 },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  subjectLabel: { fontSize: 16 },
  modeTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  modeTagText: { fontSize: 12 },
  headerBtn: { width: 40, alignItems: "center" },
  historyLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: {
    position: "absolute", left: 0, right: 0, top: "30%",
    alignItems: "center", paddingHorizontal: 40, gap: 10, zIndex: -1,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: 16, textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyHint: { fontSize: 12, textAlign: "center", lineHeight: 18, fontStyle: "italic" },
  messageList: { paddingHorizontal: 16 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 12 },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  avatarDot: {
    width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center",
    marginBottom: 2,
  },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 18, gap: 8 },
  userBubble: { borderBottomRightRadius: 4 },
  assistantBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  messageImage: { width: "100%", height: 200, borderRadius: 12 },
  messageText: { fontSize: 15, lineHeight: 22 },
  inputContainer: {
    flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12,
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  imageBtn: { padding: 8, paddingBottom: 12 },
  recordingActive: { backgroundColor: "#ef444420", borderRadius: 20 },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginBottom: 2,
  },
});
