import React, { useState, useRef, useCallback } from "react";
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
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";
import { useProgress } from "@/contexts/ProgressContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUri?: string;
  timestamp: Date;
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
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const modeColor = MODE_COLORS[mode ?? "ask"] ?? colors.primary;
  const modeLabel = MODE_LABELS[mode ?? "ask"] ?? "Ask";

  const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";

  const sendMessage = useCallback(async (content: string, imageBase64?: string) => {
    if (!content.trim() && !imageBase64) return;
    if (isSending) return;

    const userMessage: Message = {
      id: Date.now().toString() + "u",
      role: "user",
      content: imageBase64 ? content || "[Image question sent]" : content,
      imageUri: selectedImage ?? undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [userMessage, ...prev]);
    setInput("");
    setSelectedImage(null);
    setIsSending(true);
    setStreamingContent("");

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const endpoint = imageBase64
        ? `${baseUrl}/api/tutor/sessions/${sessionId}/image-messages`
        : `${baseUrl}/api/tutor/sessions/${sessionId}/messages`;

      const body = imageBase64
        ? { imageBase64, grade, board, subject, mode, deviceId: profile?.deviceId ?? "" }
        : { content, grade, board, subject, mode, deviceId: profile?.deviceId ?? "" };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                accumulated += data.content;
                setStreamingContent(accumulated);
              }
              if (data.done) {
                const assistantMessage: Message = {
                  id: Date.now().toString() + "a",
                  role: "assistant",
                  content: accumulated,
                  timestamp: new Date(),
                };
                setMessages((prev) => [assistantMessage, ...prev]);
                setStreamingContent("");
                awardXp(10, subject ?? "General");
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (_e) {}
          }
        }
      }
    } catch (err) {
      const errMessage: Message = {
        id: Date.now().toString() + "e",
        role: "assistant",
        content: "I had trouble connecting. Please check your internet and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [errMessage, ...prev]);
    } finally {
      setIsSending(false);
      setStreamingContent("");
    }
  }, [isSending, selectedImage, baseUrl, sessionId, grade, board, subject, mode, profile, awardXp]);

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
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      if (asset.base64) {
        await sendMessage("[Scanned question from image]", asset.base64);
      }
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
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      if (asset.base64) {
        await sendMessage("[Scanned question from camera]", asset.base64);
      }
    }
  };

  const headerHeight = 60;
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
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
          ]}
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
        </View>
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.chatHeader, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
        <View style={{ width: 40 }} />
      </View>

      {messages.length === 0 && !isSending && (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: modeColor + "20" }]}>
            <Ionicons name="sparkles" size={32} color={modeColor} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {grade} · {board} · {subject}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Ask your question or upload a photo of your textbook
          </Text>
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
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: 16, paddingTop: 16 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          scrollEnabled={messages.length > 0}
          ListHeaderComponent={streamingMessage}
        />

        <View style={[styles.inputContainer, { paddingBottom: bottomPad + 8, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.imageBtn} onPress={takePhoto} testID="camera-btn">
            <Ionicons name="camera" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageBtn} onPress={pickImage} testID="gallery-btn">
            <Ionicons name="image" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, fontFamily: "Inter_400Regular" }]}
            placeholder="Ask your question..."
            placeholderTextColor={colors.mutedForeground}
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
  emptyState: {
    position: "absolute", left: 0, right: 0, top: "35%",
    alignItems: "center", paddingHorizontal: 40, gap: 12, zIndex: -1,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: 16, textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
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
  input: {
    flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginBottom: 2,
  },
});
