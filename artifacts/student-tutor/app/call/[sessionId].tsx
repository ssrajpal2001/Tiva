import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

// Extend window for webkit AudioContext
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
import { useProfile } from "@/contexts/ProfileContext";
import { useColors } from "@/hooks/useColors";

type CallState = "calling" | "connected" | "ended";

interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
}

function getWsUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
  return apiUrl.replace(/^https?/, "ws");
}

function PulseRing({ color, delay = 0 }: { color: string; delay?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity, delay]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { borderColor: color, transform: [{ scale }], opacity },
      ]}
    />
  );
}

export default function CallScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { profile } = useProfile();

  const [callState, setCallState] = useState<CallState>("calling");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  // Native recording ref
  const recordingRef = useRef<Audio.Recording | null>(null);
  // Web recording ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  // Playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptScrollRef = useRef<ScrollView>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable refs for mutable state — avoids re-creating callbacks and re-connecting WS
  const isMutedRef = useRef(false);
  const isAISpeakingRef = useRef(false);

  const firstName = profile?.name?.split(" ")[0] ?? "there";

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Keep refs in sync with state
  const setIsMutedSync = (val: boolean) => {
    isMutedRef.current = val;
    setIsMuted(val);
  };
  const setIsAISpeakingSync = (val: boolean) => {
    isAISpeakingRef.current = val;
    setIsAISpeaking(val);
  };

  // Stable stopRecording — no deps that change
  const stopRecording = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (Platform.OS === "web") {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        // ondataavailable + onstop will send the buffer
      }
      return;
    }

    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri && wsRef.current?.readyState === WebSocket.OPEN) {
        const res = await fetch(uri);
        const arrayBuffer = await res.arrayBuffer();
        wsRef.current.send(arrayBuffer);
      }
    } catch {
      // ignore
    }
  }, []);

  // Stable startRecording — reads mutable state from refs, not closure variables
  const startRecording = useCallback(async () => {
    if (isMutedRef.current || isAISpeakingRef.current) return;

    if (Platform.OS === "web") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const mr = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mr;
        webChunksRef.current = [];

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) webChunksRef.current.push(e.data);
        };
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (webChunksRef.current.length === 0) return;
          const blob = new Blob(webChunksRef.current, { type: mimeType });
          const ab = await blob.arrayBuffer();
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(ab);
          }
        };

        mr.start(250); // collect chunks every 250ms
        // Auto-stop after 8s
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => stopRecording(), 8000);
      } catch {
        // mic permission denied or not available
      }
      return;
    }

    // Native path
    try {
      if (recordingRef.current) await stopRecording();

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => stopRecording(), 8000);
    } catch {
      // ignore mic errors
    }
  }, [stopRecording]);

  // Stable playAudioBuffer — reads isMuted from ref
  const playAudioBuffer = useCallback(async (arrayBuffer: ArrayBuffer) => {
    setIsAISpeakingSync(true);

    if (Platform.OS === "web") {
      try {
        const Ctx = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctx) { setIsAISpeakingSync(false); return; }
        if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        source.onended = () => {
          setIsAISpeakingSync(false);
          if (!isMutedRef.current) startRecording();
        };
        source.start();
      } catch {
        setIsAISpeakingSync(false);
      }
      return;
    }

    // Native path
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
      );
      const { sound } = await Audio.Sound.createAsync({ uri: `data:audio/mp3;base64,${base64}` });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsAISpeakingSync(false);
          if (!isMutedRef.current) startRecording();
        }
      });
      await sound.playAsync();
    } catch {
      setIsAISpeakingSync(false);
    }
  }, [startRecording]);

  // WebSocket connection — runs ONCE on mount; stable because playAudioBuffer is stable
  useEffect(() => {
    const timeout = setTimeout(() => {
      const wsUrl = `${getWsUrl()}/api/call/ws/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setCallState("connected");
        timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "transcript") {
              setTranscript((prev) => [...prev, { role: msg.role, text: msg.text }]);
              setTimeout(() => transcriptScrollRef.current?.scrollToEnd({ animated: true }), 100);
            }
          } catch { /* ignore */ }
        } else if (event.data instanceof ArrayBuffer) {
          await playAudioBuffer(event.data);
        } else if (event.data instanceof Blob) {
          const ab = await event.data.arrayBuffer();
          await playAudioBuffer(ab);
        }
      };

      ws.onclose = () => setCallState("ended");
      ws.onerror = () => setCallState("ended");
    }, 1500);

    return () => {
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      wsRef.current?.close();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — connect once on mount

  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    await stopRecording();
    wsRef.current?.send(JSON.stringify({ type: "end_call" }));
    wsRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);

    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
    fetch(`${apiUrl}/api/call/${sessionId}/end`, { method: "POST" }).catch(() => {});

    setCallState("ended");
    setTimeout(() => router.back(), 2000);
  }, [sessionId, router, stopRecording]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    setIsMutedSync(next);
    if (next && recordingRef.current) stopRecording();
    if (next && mediaRecorderRef.current?.state === "recording") stopRecording();
  }, [stopRecording]);

  const CALL_GREEN = "#25d366";
  const CALL_RED = "#ef4444";

  if (callState === "calling") {
    return (
      <View style={[styles.container, { backgroundColor: "#0a2218", paddingTop: insets.top }]}>
        <View style={styles.callingCenter}>
          <View style={styles.avatarWrapper}>
            <PulseRing color={CALL_GREEN} delay={0} />
            <PulseRing color={CALL_GREEN} delay={400} />
            <PulseRing color={CALL_GREEN} delay={800} />
            <View style={[styles.avatar, { backgroundColor: CALL_GREEN }]}>
              <Text style={styles.avatarText}>TV</Text>
            </View>
          </View>
          <Text style={styles.callingName}>TiVa Mentor</Text>
          <Text style={styles.callingStatus}>Calling...</Text>
        </View>
        <View style={styles.callingActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: CALL_RED }]} onPress={handleEndCall}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (callState === "ended") {
    return (
      <View style={[styles.container, { backgroundColor: "#0a2218", paddingTop: insets.top }]}>
        <View style={styles.callingCenter}>
          <View style={[styles.avatar, { backgroundColor: "#555" }]}>
            <Text style={styles.avatarText}>TV</Text>
          </View>
          <Text style={styles.callingName}>TiVa Mentor</Text>
          <Text style={styles.callingStatus}>Call ended · {formatDuration(callDuration)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#0a2218", paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: CALL_GREEN, width: 44, height: 44, borderRadius: 22 }]}>
          <Text style={[styles.avatarText, { fontSize: 16 }]}>TV</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>TiVa Mentor</Text>
          <View style={styles.durationRow}>
            {isAISpeaking && <View style={styles.speakingDot} />}
            <Text style={styles.headerDuration}>
              {isAISpeaking ? "Speaking..." : formatDuration(callDuration)}
            </Text>
          </View>
        </View>
      </View>

      {/* Transcript */}
      <ScrollView
        ref={transcriptScrollRef}
        style={styles.transcriptArea}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
      >
        {transcript.length === 0 && (
          <Text style={styles.waitingText}>Connecting to TiVa...</Text>
        )}
        {transcript.map((entry, i) => (
          <View key={i} style={[styles.transcriptEntry, entry.role === "user" ? styles.userEntry : styles.aiEntry]}>
            <Text style={[styles.transcriptRole, { color: entry.role === "user" ? CALL_GREEN : "#aaa" }]}>
              {entry.role === "user" ? firstName : "TiVa"}
            </Text>
            <Text style={styles.transcriptText}>{entry.text}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Mic indicator */}
      {!isMuted && callState === "connected" && !isAISpeaking && (
        <View style={styles.listeningBanner}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningText}>Listening...</Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.endCallBtn, { backgroundColor: CALL_RED }]} onPress={handleEndCall}>
          <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={() => transcriptScrollRef.current?.scrollToEnd({ animated: true })}>
          <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Transcript</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  callingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  callingName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
  },
  callingStatus: {
    fontSize: 16,
    color: "#aaa",
  },
  callingActions: {
    paddingBottom: 60,
    alignItems: "center",
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff18",
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  speakingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#25d366",
  },
  headerDuration: {
    fontSize: 13,
    color: "#aaa",
  },
  transcriptArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  transcriptContent: {
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  waitingText: {
    color: "#666",
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
  transcriptEntry: {
    maxWidth: "85%",
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  userEntry: {
    alignSelf: "flex-end",
    backgroundColor: "#1a3a2a",
  },
  aiEntry: {
    alignSelf: "flex-start",
    backgroundColor: "#1a1a2e",
  },
  transcriptRole: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 14,
    color: "#e0e0e0",
    lineHeight: 20,
  },
  listeningBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: "#ffffff08",
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#25d366",
  },
  listeningText: {
    color: "#25d366",
    fontSize: 13,
    fontWeight: "500",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 40,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#ffffff18",
  },
  controlBtn: {
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 50,
    backgroundColor: "#ffffff18",
    width: 64,
    height: 64,
    justifyContent: "center",
  },
  controlBtnActive: {
    backgroundColor: "#ef444440",
  },
  controlLabel: {
    fontSize: 10,
    color: "#aaa",
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
