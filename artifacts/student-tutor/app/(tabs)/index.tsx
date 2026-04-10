import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

interface Session {
  id: number;
  subject: string;
  mode: string;
  title: string;
  updatedAt: string;
}

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

function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

async function createServerSession(
  deviceId: string,
  subject: string,
  mode: string,
  grade: string,
  board: string,
): Promise<number | null> {
  try {
    const title = `${subject} - ${MODE_LABELS[mode] ?? mode}`;
    const response = await fetch(`${getBaseUrl()}/api/tutor/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, subject, mode, title, grade, board }),
    });
    if (!response.ok) return null;
    const session = await response.json();
    return session.id as number;
  } catch {
    return null;
  }
}

async function loadServerSessions(deviceId: string): Promise<Session[]> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/tutor/sessions?deviceId=${encodeURIComponent(deviceId)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export default function ChatTab() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, loading } = useProfile();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [startingSession, setStartingSession] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.deviceId) {
      setSessionsLoading(true);
      loadServerSessions(profile.deviceId).then((result) => {
        setSessions(result);
        setSessionsLoading(false);
      });
    }
  }, [profile?.deviceId]);

  const startNewSession = async (subject: string, mode: string) => {
    if (!profile) {
      router.push("/onboarding");
      return;
    }
    const key = `${subject}:${mode}`;
    setStartingSession(key);
    const sessionId = await createServerSession(profile.deviceId, subject, mode, profile.grade, profile.board);
    setStartingSession(null);
    if (!sessionId) {
      Alert.alert("Connection Error", "Could not connect to the tutor. Please try again.");
      return;
    }
    router.push({
      pathname: "/chat/[sessionId]",
      params: {
        sessionId: sessionId.toString(),
        subject,
        mode,
        grade: profile.grade,
        board: profile.board,
      },
    });
  };

  const deleteSession = async (id: number) => {
    if (!profile?.deviceId) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`${getBaseUrl()}/api/tutor/sessions/${id}?deviceId=${encodeURIComponent(profile.deviceId)}`, {
        method: "DELETE",
      });
    } catch {
    }
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
                const key = `${subject}:ask`;
                const isStarting = startingSession === key;
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.subjectCard, { backgroundColor: color + "18", borderColor: color + "40", opacity: isStarting ? 0.6 : 1 }]}
                    onPress={() => startNewSession(subject, "ask")}
                    activeOpacity={0.7}
                    disabled={isStarting}
                  >
                    {isStarting ? (
                      <ActivityIndicator size="small" color={color} />
                    ) : (
                      <Ionicons name="chatbubble-ellipses" size={20} color={color} />
                    )}
                    <Text style={[styles.subjectName, { color, fontFamily: "Inter_600SemiBold" }]}>{subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {sessionsLoading ? (
              <View style={styles.sessionsLoadingRow}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              </View>
            ) : sessions.length > 0 ? (
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold", marginTop: 24 }]}>
                Recent Chats
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !sessionsLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Start by tapping a subject above
              </Text>
            </View>
          ) : null
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
  sessionsLoadingRow: { alignItems: "center", paddingTop: 20 },
});
