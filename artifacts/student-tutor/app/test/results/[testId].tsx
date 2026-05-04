import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface Question {
  id: number;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  topic: string;
}

interface TestData {
  id: number;
  subject: string;
  type: string;
  score: number;
  totalQuestions: number;
  questions: Question[];
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

const OPTION_LABELS: Record<string, string> = { A: "A", B: "B", C: "C", D: "D" };

export default function TestResultsScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!testId) return;
    fetch(`${getBaseUrl()}/api/tests/${testId}`)
      .then((r) => r.json())
      .then((data) => setTest(data as TestData))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!test) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Results not found.</Text>
      </View>
    );
  }

  const percentage = test.score != null ? Math.round((test.score / test.totalQuestions) * 100) : null;
  const scoreColor = percentage == null ? colors.mutedForeground : percentage >= 80 ? "#10b981" : percentage >= 60 ? colors.warning : "#ef4444";
  const grade = percentage == null ? "–" : percentage >= 90 ? "A+" : percentage >= 80 ? "A" : percentage >= 70 ? "B" : percentage >= 60 ? "C" : "D";
  const coinsEarned = percentage == null ? 0 : percentage >= 80 ? 20 : percentage >= 60 ? 10 : 5;

  const wrongQuestions = test.questions.filter((q) => q.isCorrect === false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/tests")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Results</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Score card */}
      <View style={[styles.scoreCard, { backgroundColor: scoreColor + "18", borderColor: scoreColor + "40" }]}>
        <Text style={[styles.gradeText, { color: scoreColor }]}>{grade}</Text>
        <Text style={[styles.scoreText, { color: colors.foreground }]}>
          {test.score ?? 0} / {test.totalQuestions} correct
        </Text>
        <Text style={[styles.percentText, { color: scoreColor }]}>{percentage ?? 0}%</Text>
        <Text style={[styles.subjectText, { color: colors.mutedForeground }]}>{test.subject} · {test.type}</Text>

        {/* Coins earned */}
        <View style={[styles.coinsBadge, { backgroundColor: "#f59e0b20", borderColor: "#f59e0b" }]}>
          <Ionicons name="logo-bitcoin" size={16} color="#f59e0b" />
          <Text style={[styles.coinsText, { color: "#f59e0b" }]}>+{coinsEarned} TiVa Coins earned</Text>
        </View>
      </View>

      {/* Wrong answers breakdown */}
      {wrongQuestions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Needs Improvement ({wrongQuestions.length})
          </Text>
          {wrongQuestions.map((q) => {
            const optionMap: Record<string, string | null> = {
              A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD,
            };
            return (
              <View key={q.id} style={[styles.questionCard, { backgroundColor: colors.card, borderColor: "#ef444440" }]}>
                <View style={[styles.topicTag, { backgroundColor: "#ef444415" }]}>
                  <Text style={[styles.topicText, { color: "#ef4444" }]}>{q.topic}</Text>
                </View>
                <Text style={[styles.questionText, { color: colors.foreground }]}>{q.questionText}</Text>
                <View style={styles.answerRow}>
                  <View style={[styles.answerBadge, { backgroundColor: "#ef444420" }]}>
                    <Text style={[styles.answerLabel, { color: "#ef4444" }]}>
                      Your answer: {q.studentAnswer ? `${OPTION_LABELS[q.studentAnswer]} — ${optionMap[q.studentAnswer] ?? ""}` : "Not answered"}
                    </Text>
                  </View>
                  <View style={[styles.answerBadge, { backgroundColor: "#10b98120" }]}>
                    <Text style={[styles.answerLabel, { color: "#10b981" }]}>
                      Correct: {OPTION_LABELS[q.correctAnswer]} — {optionMap[q.correctAnswer] ?? ""}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {wrongQuestions.length === 0 && (
        <View style={[styles.perfectCard, { backgroundColor: "#10b98115", borderColor: "#10b981" }]}>
          <Ionicons name="checkmark-circle" size={40} color="#10b981" />
          <Text style={[styles.perfectText, { color: "#10b981" }]}>Perfect Score!</Text>
          <Text style={[styles.perfectSub, { color: colors.mutedForeground }]}>All questions answered correctly.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.doneBtn, { backgroundColor: colors.primary }]}
        onPress={() => router.replace("/(tabs)/tests")}
      >
        <Text style={styles.doneBtnText}>Back to Tests</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  scoreCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 8,
  },
  gradeText: { fontSize: 56, fontWeight: "800" },
  scoreText: { fontSize: 20, fontWeight: "600" },
  percentText: { fontSize: 32, fontWeight: "700" },
  subjectText: { fontSize: 14 },
  coinsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  coinsText: { fontSize: 14, fontWeight: "600" },
  section: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  questionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  topicTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  topicText: { fontSize: 11, fontWeight: "600" },
  questionText: { fontSize: 15, lineHeight: 22 },
  answerRow: { gap: 6 },
  answerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  answerLabel: { fontSize: 13, fontWeight: "500" },
  perfectCard: {
    margin: 16,
    padding: 32,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 8,
  },
  perfectText: { fontSize: 22, fontWeight: "700" },
  perfectSub: { fontSize: 14 },
  doneBtn: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
