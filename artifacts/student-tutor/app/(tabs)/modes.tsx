import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

const MODES = [
  {
    id: "ask",
    title: "Ask Anything",
    description: "Got a doubt? Ask your AI tutor anything. Get clear, instant explanations.",
    icon: "chatbubble-ellipses" as const,
    color: "#4361ee",
  },
  {
    id: "homework",
    title: "Homework Solver",
    description: "Stuck on homework? Get step-by-step guidance that helps you learn.",
    icon: "document-text" as const,
    color: "#7209b7",
  },
  {
    id: "exam-prep",
    title: "Exam Prep",
    description: "Exam-ready answers with key points, formulas, and what examiners look for.",
    icon: "school" as const,
    color: "#f72585",
  },
  {
    id: "revision",
    title: "Quick Revision",
    description: "Last-minute revision with concise summaries, bullet points, and mnemonics.",
    icon: "refresh-circle" as const,
    color: "#f77f00",
  },
];

export default function ModesTab() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleMode = (mode: string) => {
    if (!profile?.onboarded) {
      router.push("/onboarding");
      return;
    }
    const subject = profile.subjects?.[0] ?? "Math";
    const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    router.push({
      pathname: "/chat/[sessionId]",
      params: { sessionId, subject, mode, grade: profile.grade, board: profile.board },
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Learning Modes
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Choose how you want to learn today
        </Text>
      </View>

      <View style={styles.modesContainer}>
        {MODES.map((mode) => (
          <TouchableOpacity
            key={mode.id}
            style={[styles.modeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleMode(mode.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: mode.color + "20" }]}>
              <Ionicons name={mode.icon} size={28} color={mode.color} />
            </View>
            <View style={styles.modeContent}>
              <Text style={[styles.modeTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {mode.title}
              </Text>
              <Text style={[styles.modeDescription, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {mode.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
      </View>

      {profile?.subjects && profile.subjects.length > 0 && (
        <View style={styles.subjectsSection}>
          <Text style={[styles.subjectsSectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Select a Subject
          </Text>
          {MODES.map((mode) => (
            <View key={mode.id + "_subjects"} style={styles.subjectModeRow}>
              <View style={[styles.modeTag, { backgroundColor: mode.color + "20" }]}>
                <Text style={[styles.modeTagText, { color: mode.color, fontFamily: "Inter_500Medium" }]}>
                  {mode.title}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
                {profile.subjects.map((subject) => (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.subjectPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    onPress={() => {
                      if (!profile?.onboarded) { router.push("/onboarding"); return; }
                      const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
                      router.push({
                        pathname: "/chat/[sessionId]",
                        params: { sessionId, subject, mode: mode.id, grade: profile.grade, board: profile.board },
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.subjectPillText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {subject}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 26 },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  modesContainer: { padding: 16, gap: 12 },
  modeCard: {
    flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20,
    borderWidth: 1, gap: 14,
  },
  iconContainer: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  modeContent: { flex: 1 },
  modeTitle: { fontSize: 16 },
  modeDescription: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  subjectsSection: { paddingHorizontal: 16, paddingTop: 8 },
  subjectsSectionTitle: { fontSize: 16, marginBottom: 12 },
  subjectModeRow: { marginBottom: 16 },
  modeTag: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 8 },
  modeTagText: { fontSize: 13 },
  subjectScroll: { flexGrow: 0 },
  subjectPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, marginRight: 8, borderWidth: 1,
  },
  subjectPillText: { fontSize: 14 },
});
