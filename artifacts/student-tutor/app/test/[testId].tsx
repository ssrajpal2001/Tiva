import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface Question {
  id: number;
  questionText: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string;
  topic: string;
}

interface TestData {
  id: number;
  subject: string;
  type: string;
  questions: Question[];
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

const OPTIONS = ["A", "B", "C", "D"] as const;

export default function TestScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!testId) return;
    fetch(`${getBaseUrl()}/api/tests/${testId}`)
      .then((r) => r.json())
      .then((data) => setTest(data as TestData))
      .catch(() => Alert.alert("Error", "Could not load test."))
      .finally(() => setLoading(false));
  }, [testId]);

  const selectAnswer = useCallback((questionId: number, option: string) => {
    Haptics.selectionAsync();
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const submitTest = useCallback(async () => {
    if (!test || !testId) return;

    const unanswered = test.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      Alert.alert(
        "Unanswered questions",
        `You have ${unanswered.length} unanswered question${unanswered.length > 1 ? "s" : ""}. Submit anyway?`,
        [
          { text: "Cancel" },
          { text: "Submit", style: "destructive", onPress: doSubmit },
        ],
      );
      return;
    }
    doSubmit();
  }, [test, testId, answers]);

  const doSubmit = useCallback(async () => {
    if (!testId || !test) return;
    setSubmitting(true);
    try {
      const resp = await fetch(`${getBaseUrl()}/api/tests/${testId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!resp.ok) throw new Error("Submit failed");
      router.replace(`/test/results/${testId}`);
    } catch {
      Alert.alert("Error", "Could not submit test. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [testId, test, answers, router]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Generating your test...</Text>
      </View>
    );
  }

  if (!test) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Test not found.</Text>
      </View>
    );
  }

  const questions = test.questions;
  const current = questions[currentIndex];
  const answered = Object.keys(answers).length;
  const progress = answered / questions.length;

  if (!current) {
    return null;
  }

  const optionTexts: Record<string, string | null> = {
    A: current.optionA,
    B: current.optionB,
    C: current.optionC,
    D: current.optionD,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{test.subject}</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {currentIndex + 1} / {questions.length}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          onPress={submitTest}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>Submit</Text>}
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: colors.primary }]} />
      </View>

      {/* Question navigator */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dotRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {questions.map((q, i) => (
          <TouchableOpacity
            key={q.id}
            onPress={() => setCurrentIndex(i)}
            style={[
              styles.dot,
              {
                backgroundColor: answers[q.id]
                  ? colors.primary
                  : i === currentIndex
                    ? colors.border
                    : colors.secondary,
              },
            ]}
          >
            <Text style={[styles.dotText, { color: answers[q.id] || i === currentIndex ? "#fff" : colors.mutedForeground }]}>
              {i + 1}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Question */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.topicTag, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.topicText, { color: colors.mutedForeground }]}>{current.topic}</Text>
          </View>
          <Text style={[styles.questionText, { color: colors.foreground }]}>{current.questionText}</Text>
        </View>

        <View style={styles.optionsContainer}>
          {OPTIONS.map((opt) => {
            const text = optionTexts[opt];
            if (!text) return null;
            const isSelected = answers[current.id] === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.option,
                  {
                    backgroundColor: isSelected ? colors.primary + "20" : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => selectAnswer(current.id, opt)}
              >
                <View style={[styles.optionBadge, { backgroundColor: isSelected ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.optionBadgeText, { color: isSelected ? "#fff" : colors.mutedForeground }]}>{opt}</Text>
                </View>
                <Text style={[styles.optionText, { color: colors.foreground }]}>{text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.secondary, opacity: currentIndex === 0 ? 0.4 : 1 }]}
            onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            <Ionicons name="arrow-back" size={20} color={colors.foreground} />
            <Text style={[styles.navBtnText, { color: colors.foreground }]}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: colors.secondary, opacity: currentIndex === questions.length - 1 ? 0.4 : 1 }]}
            onPress={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={currentIndex === questions.length - 1}
          >
            <Text style={[styles.navBtnText, { color: colors.foreground }]}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  headerSub: { fontSize: 12 },
  submitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  progressBar: { height: 3 },
  progressFill: { height: 3 },
  dotRow: { maxHeight: 52, paddingVertical: 8 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dotText: { fontSize: 12, fontWeight: "600" },
  content: { flex: 1, paddingHorizontal: 16 },
  questionCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  topicTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  topicText: { fontSize: 11, fontWeight: "500" },
  questionText: { fontSize: 17, lineHeight: 26, fontWeight: "500" },
  optionsContainer: { marginTop: 16, gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBadgeText: { fontSize: 14, fontWeight: "700" },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 40,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  navBtnText: { fontSize: 15, fontWeight: "500" },
});
