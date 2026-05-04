import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";

function getBaseUrl() { return process.env.EXPO_PUBLIC_API_URL ?? ""; }

const BOARDS = ["CBSE", "ICSE", "State Board"];
const YEARS = ["2024", "2023", "2022", "2021", "2020", "2019"];

export default function PrevYearPapersScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

  const [selectedBoard, setSelectedBoard] = useState(profile?.board ?? "CBSE");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedSubject, setSelectedSubject] = useState(profile?.subjects?.[0] ?? "Math");
  const [generating, setGenerating] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const subjects = profile?.subjects ?? ["Math", "Science", "English"];

  const generatePaper = useCallback(async () => {
    if (!profile?.deviceId) return;
    setGenerating(true);
    try {
      const resp = await fetch(`${getBaseUrl()}/api/tests/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: profile.deviceId,
          subject: selectedSubject,
          type: "prev_year",
          grade: profile.grade ?? "Class 10",
          board: selectedBoard,
          year: selectedYear,
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      router.push(`/test/${data.testId}`);
    } catch {
      Alert.alert("Error", "Could not generate paper. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [profile, selectedBoard, selectedYear, selectedSubject, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Previous Year Papers</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} showsVerticalScrollIndicator={false}>
        {/* Board */}
        <View>
          <Text style={[styles.label, { color: colors.foreground }]}>Board</Text>
          <View style={styles.pillRow}>
            {BOARDS.map((b) => (
              <TouchableOpacity key={b} onPress={() => setSelectedBoard(b)}
                style={[styles.pill, { backgroundColor: selectedBoard === b ? colors.primary : colors.secondary }]}>
                <Text style={[styles.pillText, { color: selectedBoard === b ? "#fff" : colors.foreground }]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subject */}
        <View>
          <Text style={[styles.label, { color: colors.foreground }]}>Subject</Text>
          <View style={styles.pillRow}>
            {subjects.map((s) => (
              <TouchableOpacity key={s} onPress={() => setSelectedSubject(s)}
                style={[styles.pill, { backgroundColor: selectedSubject === s ? colors.primary : colors.secondary }]}>
                <Text style={[styles.pillText, { color: selectedSubject === s ? "#fff" : colors.foreground }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Year */}
        <View>
          <Text style={[styles.label, { color: colors.foreground }]}>Year</Text>
          <View style={styles.pillRow}>
            {YEARS.map((y) => (
              <TouchableOpacity key={y} onPress={() => setSelectedYear(y)}
                style={[styles.pill, { backgroundColor: selectedYear === y ? colors.primary : colors.secondary }]}>
                <Text style={[styles.pillText, { color: selectedYear === y ? "#fff" : colors.foreground }]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview card */}
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="document-text" size={36} color={colors.primary} />
          <Text style={[styles.previewTitle, { color: colors.foreground }]}>
            {selectedBoard} {profile?.grade} {selectedSubject}
          </Text>
          <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
            {selectedYear} Board Exam Style · 15 questions
          </Text>
          <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
            AI generates questions in the style and pattern of {selectedYear} {selectedBoard} board exams for {profile?.grade}.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.primary }]}
          onPress={generatePaper}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.generateBtnText}>Start Mock Exam</Text>
              </>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 40, padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  pillText: { fontSize: 14, fontWeight: "500" },
  previewCard: { padding: 20, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 8 },
  previewTitle: { fontSize: 18, fontWeight: "700" },
  previewSub: { fontSize: 13 },
  previewNote: { fontSize: 12, textAlign: "center", lineHeight: 18 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, borderRadius: 14 },
  generateBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
