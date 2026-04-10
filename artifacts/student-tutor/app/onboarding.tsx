import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Platform, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

const GRADES = [
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12", "Undergraduate",
];

const BOARDS = ["CBSE", "ICSE", "State Board", "IB", "IGCSE"];

const SUBJECTS_BY_GRADE: Record<string, string[]> = {
  "Class 6": ["Math", "Science", "English", "History", "Geography", "Social Studies"],
  "Class 7": ["Math", "Science", "English", "History", "Geography", "Social Studies"],
  "Class 8": ["Math", "Science", "English", "History", "Geography", "Social Studies"],
  "Class 9": ["Math", "Science", "English", "History", "Geography", "Social Studies"],
  "Class 10": ["Math", "Science", "English", "History", "Geography", "Social Studies"],
  "Class 11": ["Math", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Economics", "History"],
  "Class 12": ["Math", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Economics", "History"],
  Undergraduate: ["Math", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Economics", "History"],
};

const GOALS = [
  "Exam Preparation", "Concept Clarity", "Homework Help", "Competitive Exams", "General Learning",
];

const LANGUAGES = ["English", "Hindi", "Hinglish"];

const STEPS = ["name", "grade", "board", "subjects", "goal", "language"] as const;
type Step = (typeof STEPS)[number];

function generateDeviceId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useProfile();

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(profile?.name ?? "");
  const [grade, setGrade] = useState(profile?.grade ?? "");
  const [board, setBoard] = useState(profile?.board ?? "");
  const [subjects, setSubjects] = useState<string[]>(profile?.subjects ?? []);
  const [goal, setGoal] = useState(profile?.goal ?? "");
  const [language, setLanguage] = useState(profile?.preferredLanguage ?? "English");

  const stepIndex = STEPS.indexOf(step);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const availableSubjects = SUBJECTS_BY_GRADE[grade] ?? SUBJECTS_BY_GRADE["Class 10"]!;

  const toggleSubject = (subject: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subjects.includes(subject)) {
      setSubjects((prev) => prev.filter((s) => s !== subject));
    } else {
      setSubjects((prev) => [...prev, subject]);
    }
  };

  const canAdvance = () => {
    switch (step) {
      case "name": return name.trim().length >= 2;
      case "grade": return grade.length > 0;
      case "board": return board.length > 0;
      case "subjects": return subjects.length > 0;
      default: return true;
    }
  };

  const next = () => {
    if (!canAdvance()) {
      Alert.alert("Please complete this step first");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextIdx = stepIndex + 1;
    if (nextIdx >= STEPS.length) {
      handleFinish();
    } else {
      setStep(STEPS[nextIdx]!);
    }
  };

  const back = () => {
    if (stepIndex > 0) {
      setStep(STEPS[stepIndex - 1]!);
    }
  };

  const handleFinish = async () => {
    const deviceId = profile?.deviceId ?? generateDeviceId();
    const profileData = {
      deviceId,
      name: name.trim(),
      grade,
      board,
      subjects,
      goal: goal || undefined,
      preferredLanguage: language.toLowerCase(),
      voicePersonality: profile?.voicePersonality ?? "friendly",
      onboarded: true,
    };
    await setProfile(profileData);

    const baseUrl = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
    fetch(`${baseUrl}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        name: name.trim(),
        grade,
        board,
        subjects,
        goal: goal || null,
        preferredLanguage: language.toLowerCase(),
        voicePersonality: "friendly",
      }),
    }).catch(() => {});

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  };

  const renderStep = () => {
    switch (step) {
      case "name":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="person" size={40} color={colors.primary} />
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              What should we call you?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your tutor will greet you by name
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card, fontFamily: "Inter_400Regular" }]}
              placeholder="Enter your name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={30}
            />
          </View>
        );

      case "grade":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="school" size={40} color={colors.primary} />
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Which class are you in?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your tutor will align answers to your curriculum
            </Text>
            <View style={styles.optionsGrid}>
              {GRADES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: grade === g ? colors.primary : colors.card,
                      borderColor: grade === g ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setGrade(g); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={[styles.optionText, { color: grade === g ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "board":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="library" size={40} color={colors.primary} />
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Which board do you follow?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your AI tutor will stay within your syllabus
            </Text>
            <View style={styles.optionsGrid}>
              {BOARDS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: board === b ? colors.primary : colors.card,
                      borderColor: board === b ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setBoard(b); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={[styles.optionText, { color: board === b ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "subjects":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="book" size={40} color={colors.primary} />
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Which subjects do you study?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Select all that apply
            </Text>
            <View style={styles.optionsGrid}>
              {availableSubjects.map((s) => {
                const selected = subjects.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.optionPill,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => toggleSubject(s)}
                  >
                    {selected && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
                    <Text style={[styles.optionText, { color: selected ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case "goal":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="flag" size={40} color={colors.primary} />
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              What is your learning goal?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Optional - helps us personalize your experience
            </Text>
            <View style={styles.optionsGrid}>
              {GOALS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: goal === g ? colors.primary : colors.card,
                      borderColor: goal === g ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setGoal(goal === g ? "" : g); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={[styles.optionText, { color: goal === g ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "language":
        return (
          <View style={styles.stepContent}>
            <Ionicons name="language" size={40} color={colors.primary} />
            <Text style={[styles.stepTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              Preferred language?
            </Text>
            <Text style={[styles.stepSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Your tutor will respond in this language
            </Text>
            <View style={styles.optionsGrid}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: language === l ? colors.primary : colors.card,
                      borderColor: language === l ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setLanguage(l); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={[styles.optionText, { color: language === l ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        {stepIndex > 0 ? (
          <TouchableOpacity onPress={back} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.dotsRow}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.dot,
                {
                  backgroundColor: i <= stepIndex ? colors.primary : colors.border,
                  width: i === stepIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad + 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.nextBtn,
            {
              backgroundColor: canAdvance() ? colors.primary : colors.border,
            },
          ]}
          onPress={next}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextBtnText, { color: canAdvance() ? colors.primaryForeground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
            {stepIndex === STEPS.length - 1 ? "Start Learning" : "Continue"}
          </Text>
          <Ionicons
            name={stepIndex === STEPS.length - 1 ? "rocket" : "arrow-forward"}
            size={20}
            color={canAdvance() ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>

        {(step === "goal" || step === "language") && (
          <TouchableOpacity onPress={next} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Skip for now
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: { width: 40 },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  scrollContent: { paddingHorizontal: 24 },
  stepContent: { gap: 20, paddingTop: 16 },
  stepTitle: { fontSize: 26, lineHeight: 34 },
  stepSubtitle: { fontSize: 15, lineHeight: 22, marginTop: -8 },
  input: {
    height: 54, borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 16, fontSize: 16,
  },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50, borderWidth: 1,
  },
  optionText: { fontSize: 14 },
  footer: {
    paddingHorizontal: 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 50,
  },
  nextBtnText: { fontSize: 17 },
  skipBtn: { alignItems: "center", paddingBottom: 4 },
  skipText: { fontSize: 14 },
});
