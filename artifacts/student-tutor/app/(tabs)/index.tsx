import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

interface Session {
  id: number;
  subject: string;
  mode: string;
  title: string;
  updatedAt: string;
}

const SESSIONS_KEY = "chat_sessions_v1";

const SUBJECT_COLORS: Record<string, string> = {
  math: "#4361ee",
  science: "#7209b7",
  physics: "#7209b7",
  chemistry: "#c77dff",
  biology: "#06d6a0",
  english: "#f72585",
  history: "#f77f00",
  geography: "#2ec4b6",
  "social studies": "#f77f00",
  "computer science": "#06d6a0",
  economics: "#ffd166",
};

const MODE_LABELS: Record<string, string> = {
  ask: "Ask Anything",
  homework: "Homework",
  "exam-prep": "Exam Prep",
  revision: "Revision",
};

const MODE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ask: "chatbubble-ellipses",
  homework: "document-text",
  "exam-prep": "school",
  revision: "refresh-circle",
};

export default function ChatTab() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, loading } = useProfile();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSIONS_KEY);
        if (raw) setSessions(JSON.parse(raw));
      } catch (_e) {}
      setSessionsLoaded(true);
    })();
  }, []);

  const startNewSession = (subject: string, mode: string) => {
    if (!profile) {
      router.push("/onboarding");
      return;
    }
    const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newSession: Session = {
      id: parseInt(sessionId.substring(0, 10)),
      subject,
      mode,
      title: `${subject} - ${MODE_LABELS[mode] ?? mode}`,
      updatedAt: new Date().toISOString(),
    };
    const updatedSessions = [newSession, ...sessions].slice(0, 20);
    setSessions(updatedSessions);
    AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions)).catch(() => {});
    router.push({
      pathname: "/chat/[sessionId]",
      params: {
        sessionId: sessionId,
        subject,
        mode,
        grade: profile.grade,
        board: profile.board,
      },
    });
  };

  const deleteSession = async (id: number) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile?.onboarded) {
    return (
      <View style={[styles.onboardContainer, { backgroundColor: colors.background, paddingTop: topPad + 24 }]}>
        <View style={[styles.onboardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="school" size={48} color={colors.primary} />
          <Text style={[styles.onboardTitle, { color: colors.foreground }]}>Welcome to StudyBuddy</Text>
          <Text style={[styles.onboardSubtitle, { color: colors.mutedForeground }]}>
            Your personal AI tutor for every subject
          </Text>
          <TouchableOpacity
            style={[styles.onboardBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/onboarding")}
          >
            <Text style={[styles.onboardBtnText, { color: colors.primaryForeground }]}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const subjects = profile.subjects ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Hey {profile.name.split(" ")[0]}!
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {profile.grade} | {profile.board}
        </Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id.toString()}
        scrollEnabled={sessions.length > 0}
        contentContainerStyle={{ paddingBottom: bottomPad + 100, paddingHorizontal: 16 }}
        ListHeaderComponent={
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Ask a Subject
            </Text>
            <View style={styles.subjectsGrid}>
              {subjects.map((subject) => {
                const color = SUBJECT_COLORS[subject.toLowerCase()] ?? colors.primary;
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.subjectCard, { backgroundColor: color + "18", borderColor: color + "40" }]}
                    onPress={() => startNewSession(subject, "ask")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color={color} />
                    <Text style={[styles.subjectName, { color, fontFamily: "Inter_600SemiBold" }]}>{subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {sessions.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 24 }]}>
                Recent Chats
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Start by tapping a subject above
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = SUBJECT_COLORS[item.subject.toLowerCase()] ?? colors.primary;
          return (
            <TouchableOpacity
              style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() =>
                router.push({
                  pathname: "/chat/[sessionId]",
                  params: {
                    sessionId: item.id.toString(),
                    subject: item.subject,
                    mode: item.mode,
                    grade: profile.grade,
                    board: profile.board,
                  },
                })
              }
              activeOpacity={0.7}
            >
              <View style={[styles.sessionDot, { backgroundColor: color }]} />
              <View style={styles.sessionInfo}>
                <Text style={[styles.sessionTitle, { color: colors.foreground, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {MODE_LABELS[item.mode] ?? item.mode} · {new Date(item.updatedAt).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Delete Chat", "Remove this chat history?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteSession(item.id) },
                  ])
                }
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  onboardContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  onboardCard: {
    width: "100%", borderRadius: 24, padding: 32, alignItems: "center",
    borderWidth: 1, gap: 12,
  },
  onboardTitle: { fontSize: 24, textAlign: "center", fontWeight: "700" },
  onboardSubtitle: { fontSize: 15, textAlign: "center" },
  onboardBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 50 },
  onboardBtnText: { fontSize: 16, fontWeight: "600" },
  header: {
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 26 },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  sectionTitle: { fontSize: 16, marginTop: 20, marginBottom: 12 },
  subjectsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subjectCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 50, borderWidth: 1,
  },
  subjectName: { fontSize: 14 },
  sessionCard: {
    flexDirection: "row", alignItems: "center", padding: 14,
    borderRadius: 16, borderWidth: 1, marginBottom: 10,
  },
  sessionDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 15 },
  sessionMeta: { fontSize: 13, marginTop: 2 },
  deleteBtn: { padding: 4 },
  emptyState: { alignItems: "center", paddingTop: 32, gap: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
