import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";
import { useProgress } from "@/contexts/ProgressContext";

interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface PracticeAttempt {
  date: string;
  questions: PracticeQuestion[];
  answers: Record<string, number>;
  submitted: boolean;
  score: number;
}

interface WeakTopic {
  id: number;
  subject: string;
  topic: string;
  errorCount: number;
}

const QUESTION_BANK: Record<string, Omit<PracticeQuestion, "id" | "subject">[]> = {
  math: [
    {
      topic: "Linear equations",
      question: "If 2x + 5 = 17, what is x?",
      options: ["4", "5", "6", "7"],
      answerIndex: 2,
      explanation: "Subtract 5 from both sides to get 2x = 12, then divide by 2.",
    },
    {
      topic: "Fractions",
      question: "What is 3/4 of 28?",
      options: ["18", "19", "20", "21"],
      answerIndex: 3,
      explanation: "28 divided by 4 is 7, and 7 multiplied by 3 is 21.",
    },
    {
      topic: "Percentages",
      question: "What is 15 percent of 200?",
      options: ["15", "20", "25", "30"],
      answerIndex: 3,
      explanation: "15 percent means 15/100. So 200 x 15/100 = 30.",
    },
  ],
  science: [
    {
      topic: "Photosynthesis",
      question: "Which gas do plants take in during photosynthesis?",
      options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
      answerIndex: 1,
      explanation: "Plants use carbon dioxide and water to make food in sunlight.",
    },
    {
      topic: "Forces",
      question: "Which force pulls objects toward Earth?",
      options: ["Friction", "Magnetism", "Gravity", "Buoyancy"],
      answerIndex: 2,
      explanation: "Gravity is the attractive force between Earth and objects.",
    },
    {
      topic: "Matter",
      question: "Water changing into steam is an example of what process?",
      options: ["Freezing", "Evaporation", "Condensation", "Melting"],
      answerIndex: 1,
      explanation: "Evaporation changes a liquid into gas when heat is added.",
    },
  ],
  physics: [
    {
      topic: "Speed",
      question: "If distance is 100 m and time is 20 s, what is speed?",
      options: ["2 m/s", "5 m/s", "20 m/s", "120 m/s"],
      answerIndex: 1,
      explanation: "Speed = distance/time = 100/20 = 5 m/s.",
    },
    {
      topic: "Electricity",
      question: "Which unit is used to measure electric current?",
      options: ["Volt", "Ohm", "Ampere", "Watt"],
      answerIndex: 2,
      explanation: "Electric current is measured in amperes.",
    },
  ],
  chemistry: [
    {
      topic: "Atoms",
      question: "Which particle has a negative charge?",
      options: ["Proton", "Neutron", "Electron", "Nucleus"],
      answerIndex: 2,
      explanation: "Electrons are negatively charged particles around the nucleus.",
    },
    {
      topic: "Acids and bases",
      question: "Which value is neutral on the pH scale?",
      options: ["1", "7", "10", "14"],
      answerIndex: 1,
      explanation: "pH 7 is neutral, like pure water.",
    },
  ],
  biology: [
    {
      topic: "Cells",
      question: "Which part of the cell controls its activities?",
      options: ["Cell wall", "Nucleus", "Cytoplasm", "Vacuole"],
      answerIndex: 1,
      explanation: "The nucleus contains genetic material and controls cell activities.",
    },
    {
      topic: "Human body",
      question: "Which organ pumps blood around the body?",
      options: ["Lungs", "Brain", "Heart", "Kidney"],
      answerIndex: 2,
      explanation: "The heart pumps blood through blood vessels to the body.",
    },
  ],
  english: [
    {
      topic: "Parts of speech",
      question: "In the sentence 'The child runs quickly', which word is the adverb?",
      options: ["The", "child", "runs", "quickly"],
      answerIndex: 3,
      explanation: "Quickly describes how the action is done, so it is an adverb.",
    },
    {
      topic: "Tenses",
      question: "Which sentence is in past tense?",
      options: ["I play", "I played", "I will play", "I am playing"],
      answerIndex: 1,
      explanation: "Played shows the action already happened.",
    },
  ],
  history: [
    {
      topic: "Indian freedom movement",
      question: "Who led the Salt March in 1930?",
      options: ["Jawaharlal Nehru", "Mahatma Gandhi", "Sardar Patel", "Subhas Chandra Bose"],
      answerIndex: 1,
      explanation: "Mahatma Gandhi led the Salt March as a protest against the salt tax.",
    },
  ],
  geography: [
    {
      topic: "Rivers",
      question: "Which is the longest river in India?",
      options: ["Yamuna", "Godavari", "Ganga", "Narmada"],
      answerIndex: 2,
      explanation: "The Ganga is generally taught as India's longest river.",
    },
  ],
  "computer science": [
    {
      topic: "Algorithms",
      question: "What is an algorithm?",
      options: ["A computer virus", "A step-by-step procedure", "A keyboard", "A type of screen"],
      answerIndex: 1,
      explanation: "An algorithm is a clear sequence of steps to solve a problem.",
    },
  ],
  economics: [
    {
      topic: "Demand",
      question: "What usually happens to demand when price rises, other things equal?",
      options: ["It rises", "It falls", "It becomes zero always", "It is unrelated"],
      answerIndex: 1,
      explanation: "In basic demand theory, higher price usually reduces quantity demanded.",
    },
  ],
};

const FALLBACK_QUESTIONS: Omit<PracticeQuestion, "id" | "subject">[] = [
  {
    topic: "Concept clarity",
    question: "What is the best first step when solving a new question?",
    options: ["Guess the answer", "Read and identify what is asked", "Skip all working", "Copy the final answer"],
    answerIndex: 1,
    explanation: "Understanding what is asked prevents mistakes and makes the solution easier.",
  },
  {
    topic: "Revision method",
    question: "Which revision habit is most effective?",
    options: ["Only reading once", "Testing yourself after learning", "Avoiding mistakes", "Studying without breaks"],
    answerIndex: 1,
    explanation: "Active recall through self-testing strengthens memory.",
  },
];

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0] ?? "today";
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase();
}

function buildDailyQuestions(subjects: string[], date: string): PracticeQuestion[] {
  const activeSubjects = subjects.length > 0 ? subjects : ["Math", "Science", "English"];
  const questions: PracticeQuestion[] = [];

  for (let i = 0; questions.length < 5 && i < activeSubjects.length * 3; i += 1) {
    const subject = activeSubjects[i % activeSubjects.length] ?? "General";
    const bank = QUESTION_BANK[normalizeSubject(subject)] ?? FALLBACK_QUESTIONS;
    const source = bank[(hashString(`${date}:${subject}:${i}`) + i) % bank.length] ?? FALLBACK_QUESTIONS[0]!;
    questions.push({
      ...source,
      id: `${date}-${normalizeSubject(subject).replace(/\s+/g, "-")}-${i}`,
      subject,
    });
  }

  return questions;
}

function buildRoadmap(subjects: string[], goal?: string) {
  const focus = subjects.length > 0 ? subjects.slice(0, 4) : ["Math", "Science", "English"];
  return [
    {
      title: "Phase 1: Foundation check",
      subtitle: goal ? `Align basics to goal: ${goal}` : "Find gaps before they become exam mistakes",
      items: focus.map((subject) => `Revise core ${subject} formulas, definitions, and examples`),
      color: "#4361ee",
      icon: "map" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Phase 2: Daily practice",
      subtitle: "Short drills every day, reviewed immediately",
      items: focus.map((subject) => `Solve 5 targeted ${subject} questions and read feedback`),
      color: "#f72585",
      icon: "checkmark-done-circle" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Phase 3: Smart revision",
      subtitle: "Repeat weak areas until they become strengths",
      items: focus.map((subject) => `Use revision mode for weak ${subject} topics before tests`),
      color: "#f77f00",
      icon: "refresh-circle" as keyof typeof Ionicons.glyphMap,
    },
  ];
}

export default function StudyTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, loading } = useProfile();
  const { progress, awardXp, refreshFromBackend } = useProgress();

  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [loadingPractice, setLoadingPractice] = useState(true);
  const [startingRevision, setStartingRevision] = useState<string | null>(null);

  const date = todayKey();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const subjects = profile?.subjects ?? [];
  const roadmap = useMemo(() => buildRoadmap(subjects, profile?.goal), [subjects, profile?.goal]);

  useEffect(() => {
    const loadPractice = async () => {
      if (!profile?.deviceId) {
        setLoadingPractice(false);
        return;
      }

      const key = `daily_practice_v1:${profile.deviceId}:${date}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          setAttempt(JSON.parse(raw) as PracticeAttempt);
        } else {
          const nextAttempt: PracticeAttempt = {
            date,
            questions: buildDailyQuestions(profile.subjects ?? [], date),
            answers: {},
            submitted: false,
            score: 0,
          };
          await AsyncStorage.setItem(key, JSON.stringify(nextAttempt));
          setAttempt(nextAttempt);
        }
      } catch {
      } finally {
        setLoadingPractice(false);
      }
    };

    loadPractice();
  }, [date, profile?.deviceId, profile?.subjects]);

  useEffect(() => {
    const fetchWeakTopics = async () => {
      if (!profile?.deviceId) return;
      try {
        const response = await fetch(`${getBaseUrl()}/api/tutor/weak-topics/${encodeURIComponent(profile.deviceId)}`);
        if (response.ok) {
          const data = await response.json();
          setWeakTopics(data as WeakTopic[]);
        }
      } catch {
      }
    };
    fetchWeakTopics();
  }, [profile?.deviceId]);

  const persistAttempt = useCallback(async (nextAttempt: PracticeAttempt) => {
    if (!profile?.deviceId) return;
    setAttempt(nextAttempt);
    await AsyncStorage.setItem(`daily_practice_v1:${profile.deviceId}:${nextAttempt.date}`, JSON.stringify(nextAttempt));
  }, [profile?.deviceId]);

  const selectAnswer = async (questionId: string, optionIndex: number) => {
    if (!attempt || attempt.submitted) return;
    await persistAttempt({
      ...attempt,
      answers: { ...attempt.answers, [questionId]: optionIndex },
    });
  };

  const submitPractice = async () => {
    if (!attempt || !profile?.deviceId) return;
    if (Object.keys(attempt.answers).length < attempt.questions.length) {
      Alert.alert("Complete practice", "Please answer all questions before submitting.");
      return;
    }

    const score = attempt.questions.reduce((total, question) => {
      return total + (attempt.answers[question.id] === question.answerIndex ? 1 : 0);
    }, 0);

    const submittedAttempt = { ...attempt, submitted: true, score };
    await persistAttempt(submittedAttempt);

    const xp = 10 + score * 4;
    awardXp(xp, "Daily Practice", 5);

    try {
      await fetch(`${getBaseUrl()}/api/progress/${encodeURIComponent(profile.deviceId)}/xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp, subject: "Daily Practice", reason: "practice_day_complete", timeMinutes: 5 }),
      });
      await refreshFromBackend(profile.deviceId);
    } catch {
    }
  };

  const resetPractice = async () => {
    if (!profile?.deviceId) return;
    const nextAttempt: PracticeAttempt = {
      date,
      questions: buildDailyQuestions(profile.subjects ?? [], `${date}:retry:${Date.now()}`),
      answers: {},
      submitted: false,
      score: 0,
    };
    await persistAttempt(nextAttempt);
  };

  const startRevisionChat = async (subject: string, topic: string) => {
    if (!profile?.onboarded) {
      router.push("/onboarding");
      return;
    }

    setStartingRevision(topic);
    try {
      const response = await fetch(`${getBaseUrl()}/api/tutor/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: profile.deviceId,
          subject,
          mode: "revision",
          title: `${subject} revision - ${topic}`,
          grade: profile.grade,
          board: profile.board,
        }),
      });
      if (!response.ok) throw new Error("Could not start revision");
      const session = await response.json();
      router.push({
        pathname: "/chat/[sessionId]",
        params: {
          sessionId: session.id.toString(),
          subject,
          mode: "revision",
          grade: profile.grade,
          board: profile.board,
        },
      });
    } catch {
      Alert.alert("Revision unavailable", "Could not start a revision chat. Please try again.");
    } finally {
      setStartingRevision(null);
    }
  };

  const revisionQueue = useMemo(() => {
    if (weakTopics.length > 0) {
      return weakTopics
        .slice()
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 4)
        .map((topic) => ({ subject: topic.subject, topic: topic.topic, reason: `Struggled ${topic.errorCount}x` }));
    }

    const lowPracticeSubjects = subjects.slice(0, 4).map((subject) => {
      const subjectProgress = progress.subjectBreakdown.find((item) => item.subject.toLowerCase() === subject.toLowerCase());
      return {
        subject,
        topic: `${subject} fundamentals`,
        reason: subjectProgress ? `${subjectProgress.questionCount} questions practiced` : "No practice yet",
      };
    });
    return lowPracticeSubjects.length > 0 ? lowPracticeSubjects : [{ subject: "Math", topic: "Core concepts", reason: "Start your first revision" }];
  }, [progress.subjectBreakdown, subjects, weakTopics]);

  const accuracy = attempt?.submitted ? Math.round((attempt.score / Math.max(attempt.questions.length, 1)) * 100) : null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile?.onboarded) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="school" size={48} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Build your study plan</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Complete onboarding so your roadmap, practice, and revision queue can match your grade, board, subjects, and goal.
        </Text>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push("/onboarding")}>
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>Start onboarding</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.kicker, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>1:1 AI Study Partner</Text>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Roadmap, practice, revision</Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          A Disha-style learning loop for {profile.grade} {profile.board}: plan daily, practice, get feedback, and revise weak areas.
        </Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.heroCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <View>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Today&apos;s target</Text>
            <Text style={[styles.heroValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>5 questions + 1 revision topic</Text>
          </View>
          <View style={[styles.heroPill, { backgroundColor: colors.primary }]}>
            <Text style={[styles.heroPillText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
              {accuracy === null ? "Ready" : `${accuracy}%`}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Personal roadmap</Text>
          </View>
          {roadmap.map((phase) => (
            <View key={phase.title} style={styles.roadmapItem}>
              <View style={[styles.roadmapIcon, { backgroundColor: phase.color + "20" }]}>
                <Ionicons name={phase.icon} size={18} color={phase.color} />
              </View>
              <View style={styles.roadmapContent}>
                <Text style={[styles.roadmapTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{phase.title}</Text>
                <Text style={[styles.roadmapSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{phase.subtitle}</Text>
                {phase.items.slice(0, 2).map((item) => (
                  <Text key={item} style={[styles.roadmapBullet, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>- {item}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="clipboard" size={20} color="#f72585" />
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Daily practice and feedback</Text>
          </View>

          {loadingPractice || !attempt ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              {attempt.questions.map((question, index) => {
                const selected = attempt.answers[question.id];
                const correct = selected === question.answerIndex;
                return (
                  <View key={question.id} style={[styles.questionCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={[styles.questionMeta, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                      Q{index + 1} · {question.subject} · {question.topic}
                    </Text>
                    <Text style={[styles.questionText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{question.question}</Text>
                    <View style={styles.optionsGrid}>
                      {question.options.map((option, optionIndex) => {
                        const isSelected = selected === optionIndex;
                        const isCorrectAnswer = attempt.submitted && question.answerIndex === optionIndex;
                        const isWrongSelected = attempt.submitted && isSelected && !isCorrectAnswer;
                        return (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.optionButton,
                              {
                                borderColor: isCorrectAnswer ? "#16a34a" : isWrongSelected ? "#ef4444" : isSelected ? colors.primary : colors.border,
                                backgroundColor: isCorrectAnswer ? "#16a34a18" : isWrongSelected ? "#ef444418" : isSelected ? colors.primary + "15" : colors.card,
                              },
                            ]}
                            onPress={() => selectAnswer(question.id, optionIndex)}
                            disabled={attempt.submitted}
                          >
                            <Text style={[styles.optionText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{option}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {attempt.submitted && (
                      <View style={styles.feedbackRow}>
                        <Ionicons name={correct ? "checkmark-circle" : "alert-circle"} size={17} color={correct ? "#16a34a" : "#ef4444"} />
                        <Text style={[styles.feedbackText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                          {correct ? "Correct. " : "Review this. "}{question.explanation}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {attempt.submitted ? (
                <View style={styles.resultActions}>
                  <View style={[styles.scoreCard, { backgroundColor: colors.primary + "12" }]}>
                    <Text style={[styles.scoreText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                      Score: {attempt.score}/{attempt.questions.length}
                    </Text>
                    <Text style={[styles.scoreSubtext, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      Feedback is shown under each question.
                    </Text>
                  </View>
                  <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={resetPractice}>
                    <Text style={[styles.secondaryButtonText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Retry new set</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={submitPractice}>
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>Submit and get feedback</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: "#f77f0012", borderColor: "#f77f0030" }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="refresh-circle" size={20} color="#f77f00" />
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Smart revision queue</Text>
          </View>
          {revisionQueue.map((item) => (
            <TouchableOpacity
              key={`${item.subject}:${item.topic}`}
              style={[styles.revisionRow, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => startRevisionChat(item.subject, item.topic)}
              disabled={!!startingRevision}
            >
              <View style={styles.revisionText}>
                <Text style={[styles.revisionTopic, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{item.topic}</Text>
                <Text style={[styles.revisionMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {item.subject} · {item.reason}
                </Text>
              </View>
              {startingRevision === item.topic ? (
                <ActivityIndicator color="#f77f00" />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#06d6a0" />
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Performance summary</Text>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{progress.totalQuestions}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Questions</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{progress.streak}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Day streak</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{accuracy === null ? "--" : `${accuracy}%`}</Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Today accuracy</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 18 },
  kicker: { fontSize: 13, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  headerTitle: { fontSize: 27, lineHeight: 33 },
  headerSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  content: { paddingHorizontal: 16, gap: 14 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: { fontSize: 12, marginBottom: 4 },
  heroValue: { fontSize: 18 },
  heroPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  heroPillText: { fontSize: 13 },
  section: { borderWidth: 1, borderRadius: 24, padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17 },
  roadmapItem: { flexDirection: "row", gap: 12, marginBottom: 14 },
  roadmapIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  roadmapContent: { flex: 1 },
  roadmapTitle: { fontSize: 15 },
  roadmapSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 6 },
  roadmapBullet: { fontSize: 12, lineHeight: 18 },
  questionCard: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 12 },
  questionMeta: { fontSize: 12, marginBottom: 6 },
  questionText: { fontSize: 15, lineHeight: 21 },
  optionsGrid: { gap: 8, marginTop: 10 },
  optionButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  optionText: { fontSize: 14 },
  feedbackRow: { flexDirection: "row", gap: 7, alignItems: "flex-start", marginTop: 10 },
  feedbackText: { flex: 1, fontSize: 12, lineHeight: 17 },
  resultActions: { gap: 10 },
  scoreCard: { padding: 14, borderRadius: 16 },
  scoreText: { fontSize: 16 },
  scoreSubtext: { fontSize: 12, marginTop: 3 },
  primaryButton: { borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryButtonText: { fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderRadius: 16, paddingVertical: 13, alignItems: "center" },
  secondaryButtonText: { fontSize: 14 },
  revisionRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  revisionText: { flex: 1 },
  revisionTopic: { fontSize: 14 },
  revisionMeta: { fontSize: 12, marginTop: 3 },
  metricsGrid: { flexDirection: "row", gap: 8 },
  metricItem: { flex: 1, alignItems: "center", paddingVertical: 10 },
  metricValue: { fontSize: 20 },
  metricLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  emptyTitle: { fontSize: 22, marginTop: 14 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center", marginVertical: 12 },
});
