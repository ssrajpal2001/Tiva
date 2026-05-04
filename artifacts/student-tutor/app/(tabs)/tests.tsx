import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

interface Test {
  id: number;
  subject: string;
  type: string;
  status: string;
  score: number | null;
  totalQuestions: number;
  createdAt: string;
}

interface RepeatQuestion {
  test_questions: {
    id: number;
    questionText: string;
    subject: string;
    topic: string;
    repeatCount: number;
  };
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

const TEST_TYPES = [
  { type: "daily", label: "Daily Quiz", icon: "today-outline" as const, color: "#4361ee", questions: 5 },
  { type: "weekly", label: "Weekly Test", icon: "calendar-outline" as const, color: "#7209b7", questions: 10 },
  { type: "monthly", label: "Monthly Exam", icon: "calendar-clear-outline" as const, color: "#f72585", questions: 20 },
  { type: "revision", label: "Revision Test", icon: "refresh-circle-outline" as const, color: "#f77f00", questions: 15 },
];

export default function TestsScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [recentTests, setRecentTests] = useState<Test[]>([]);
  const [repeatCount, setRepeatCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const loadData = useCallback(async () => {
    if (!profile?.deviceId) return;
    try {
      const [testsResp, repeatResp] = await Promise.all([
        fetch(`${getBaseUrl()}/api/tests?deviceId=${encodeURIComponent(profile.deviceId)}`),
        fetch(`${getBaseUrl()}/api/tests/repeat-mistakes?deviceId=${encodeURIComponent(profile.deviceId)}`),
      ]);
      if (testsResp.ok) {
        const data = await testsResp.json();
        setRecentTests((data as Test[]).slice(0, 5));
      }
      if (repeatResp.ok) {
        const data = await repeatResp.json();
        setRepeatCount((data as RepeatQuestion[]).length);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [profile?.deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startTest = useCallback(async (type: string) => {
    if (!profile?.deviceId || !profile.subjects?.length) {
      Alert.alert("Profile incomplete", "Please set up your profile with subjects first.");
      return;
    }

    const subject = profile.subjects[0] ?? "Math";
    setGenerating(type);

    try {
      const resp = await fetch(`${getBaseUrl()}/api/tests/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: profile.deviceId,
          subject,
          type,
          grade: profile.grade ?? "Class 10",
          board: profile.board ?? "CBSE",
        }),
      });

      if (!resp.ok) throw new Error("Failed to generate test");

      const data = await resp.json();
      router.push(`/test/${data.testId}`);
    } catch {
      Alert.alert("Error", "Could not generate test. Please try again.");
    } finally {
      setGenerating(null);
    }
  }, [profile, router]);

  const openRepeatMistakes = useCallback(async () => {
    if (!profile?.deviceId) return;

    // Navigate to a special repeat-mistakes flow (uses first pending repeat question's test)
    setGenerating("repeat");
    try {
      const resp = await fetch(`${getBaseUrl()}/api/tests/repeat-mistakes?deviceId=${encodeURIComponent(profile.deviceId)}`);
      const data = await resp.json() as RepeatQuestion[];
      if (data.length === 0) {
        Alert.alert("All caught up!", "You have no mistakes to repeat right now. Keep practicing!");
        return;
      }
      const testId = data[0]?.test_questions?.id;
      if (testId) {
        router.push(`/test/${testId}?mode=repeat`);
      }
    } catch {
      Alert.alert("Error", "Could not load repeat mistakes.");
    } finally {
      setGenerating(null);
    }
  }, [profile?.deviceId, router]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Tests</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Track your progress</Text>
      </View>

      {/* Repeat Mistakes Banner */}
      {repeatCount > 0 && (
        <TouchableOpacity
          style={[styles.repeatBanner, { backgroundColor: "#ef444415", borderColor: "#ef4444" }]}
          onPress={openRepeatMistakes}
          disabled={!!generating}
        >
          <View style={styles.repeatBannerLeft}>
            <Ionicons name="refresh-circle" size={28} color="#ef4444" />
            <View>
              <Text style={[styles.repeatTitle, { color: "#ef4444" }]}>Repeat Mistakes</Text>
              <Text style={[styles.repeatSubtitle, { color: colors.mutedForeground }]}>
                {repeatCount} question{repeatCount > 1 ? "s" : ""} due for review
              </Text>
            </View>
          </View>
          {generating === "repeat"
            ? <ActivityIndicator color="#ef4444" />
            : <Ionicons name="chevron-forward" size={20} color="#ef4444" />}
        </TouchableOpacity>
      )}

      {/* Start New Test */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Start a Test</Text>
        <View style={styles.testGrid}>
          {TEST_TYPES.map((t) => (
            <TouchableOpacity
              key={t.type}
              style={[styles.testCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => startTest(t.type)}
              disabled={!!generating}
            >
              <View style={[styles.testIcon, { backgroundColor: t.color + "20" }]}>
                {generating === t.type
                  ? <ActivityIndicator color={t.color} size="small" />
                  : <Ionicons name={t.icon} size={24} color={t.color} />}
              </View>
              <Text style={[styles.testCardLabel, { color: colors.foreground }]}>{t.label}</Text>
              <Text style={[styles.testCardSub, { color: colors.mutedForeground }]}>{t.questions} questions</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Tests */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Tests</Text>
        {loading
          ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
          : recentTests.length === 0
            ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="document-text-outline" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tests yet. Start one above!</Text>
              </View>
            )
            : recentTests.map((test) => (
              <TouchableOpacity
                key={test.id}
                style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/test/results/${test.id}`)}
              >
                <View style={styles.historyLeft}>
                  <Text style={[styles.historySubject, { color: colors.foreground }]}>{test.subject}</Text>
                  <Text style={[styles.historyType, { color: colors.mutedForeground }]}>
                    {test.type.charAt(0).toUpperCase() + test.type.slice(1)} · {new Date(test.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  {test.status === "completed" && test.score !== null
                    ? (
                      <Text style={[styles.historyScore, { color: test.score / test.totalQuestions >= 0.6 ? "#10b981" : "#ef4444" }]}>
                        {test.score}/{test.totalQuestions}
                      </Text>
                    )
                    : (
                      <View style={[styles.pendingBadge, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.pendingText, { color: colors.mutedForeground }]}>Pending</Text>
                      </View>
                    )}
                </View>
              </TouchableOpacity>
            ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 2 },
  subtitle: { fontSize: 14 },
  repeatBanner: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  repeatBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  repeatTitle: { fontSize: 16, fontWeight: "600" },
  repeatSubtitle: { fontSize: 13, marginTop: 2 },
  section: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  testGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  testCard: {
    width: "47%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  testIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  testCardLabel: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  testCardSub: { fontSize: 12 },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 14, textAlign: "center" },
  historyCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyLeft: { flex: 1, gap: 2 },
  historySubject: { fontSize: 15, fontWeight: "600" },
  historyType: { fontSize: 12 },
  historyRight: { alignItems: "flex-end" },
  historyScore: { fontSize: 18, fontWeight: "700" },
  pendingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pendingText: { fontSize: 12, fontWeight: "500" },
});
