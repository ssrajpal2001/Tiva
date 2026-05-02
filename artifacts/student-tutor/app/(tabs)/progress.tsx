import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProgress, BADGE_LABELS } from "@/contexts/ProgressContext";
import { useProfile } from "@/contexts/ProfileContext";

const LEVEL_NAMES = [
  "Beginner", "Explorer", "Learner", "Student", "Scholar",
  "Thinker", "Expert", "Champion", "Genius", "Master", "Legend",
];

const SUBJECT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  math: "calculator",
  science: "flask",
  physics: "planet",
  chemistry: "beaker",
  biology: "leaf",
  english: "language",
  history: "time",
  geography: "globe",
  "social studies": "people",
  "computer science": "code-slash",
  economics: "trending-up",
};

const BADGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  first_question: "star",
  ten_questions: "ribbon",
  fifty_questions: "trophy",
  streak_3: "flame",
  streak_7: "medal",
  level_5: "bookmark",
  level_10: "diamond",
  time_60: "timer",
  time_300: "school",
};

interface WeakTopic {
  id: number;
  subject: string;
  topic: string;
  errorCount: number;
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

function formatTime(minutes: number): string {
  if (minutes < 1) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ProgressTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { progress } = useProgress();
  const { profile } = useProfile();
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [weakLoading, setWeakLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const levelName = LEVEL_NAMES[Math.min(progress.level - 1, LEVEL_NAMES.length - 1)] ?? "Master";
  const nextLevelXp = Math.pow(progress.level, 2) * 100;
  const xpProgress = Math.min((progress.totalXp / nextLevelXp) * 100, 100);
  const totalTimeMinutes = progress.totalTimeMinutes ?? 0;

  useEffect(() => {
    const fetchWeakTopics = async () => {
      if (!profile?.deviceId) return;
      setWeakLoading(true);
      try {
        const response = await fetch(`${getBaseUrl()}/api/tutor/weak-topics/${encodeURIComponent(profile.deviceId)}`);
        if (response.ok) {
          const data = await response.json();
          setWeakTopics(data as WeakTopic[]);
        }
      } catch {
      } finally {
        setWeakLoading(false);
      }
    };
    fetchWeakTopics();
  }, [profile?.deviceId]);

  const topWeakTopics = weakTopics.slice(0, 5);
  const topSubjects = [...progress.subjectBreakdown].sort((a, b) => b.xp - a.xp).slice(0, 3);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Your Progress
        </Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.statsCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {progress.totalXp}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>XP</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {progress.streak}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Day Streak</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {progress.totalQuestions}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Questions</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {formatTime(totalTimeMinutes)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Time</Text>
            </View>
          </View>

          <View style={styles.levelRow}>
            <View style={styles.levelInfo}>
              <Text style={[styles.levelText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Level {progress.level} · {levelName}
              </Text>
              <Text style={[styles.xpText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {progress.totalXp}/{nextLevelXp} XP to next level
              </Text>
            </View>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${xpProgress}%` as `${number}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>

        {topSubjects.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Top Subjects
            </Text>
            {topSubjects.map((sb) => {
              const icon = SUBJECT_ICONS[sb.subject.toLowerCase()] ?? "book";
              const maxXp = Math.max(...progress.subjectBreakdown.map((s) => s.xp), 1);
              const barPercent: `${number}%` = `${Math.round((sb.xp / maxXp) * 100)}%`;
              return (
                <View key={sb.subject} style={styles.subjectRow}>
                  <View style={[styles.subjectIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Ionicons name={icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.subjectDetails}>
                    <View style={styles.subjectMeta}>
                      <Text style={[styles.subjectName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                        {sb.subject}
                      </Text>
                      <Text style={[styles.subjectXp, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {sb.xp} XP · {sb.questionCount} Qs · {formatTime(sb.timeMinutes ?? 0)}
                      </Text>
                    </View>
                    <View style={[styles.subjectTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.subjectFill, { width: barPercent, backgroundColor: colors.primary + "cc" }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {(weakLoading || topWeakTopics.length > 0) && (
          <View style={[styles.section, { backgroundColor: "#ef444410", borderColor: "#ef444430" }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Areas Needing Practice
              </Text>
            </View>
            {weakLoading ? (
              <ActivityIndicator color="#ef4444" />
            ) : topWeakTopics.map((wt) => (
              <View key={wt.id} style={styles.weakTopicRow}>
                <View style={styles.weakDot} />
                <View style={styles.weakTopicInfo}>
                  <Text style={[styles.weakTopicName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {wt.topic}
                  </Text>
                  <Text style={[styles.weakTopicMeta, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {wt.subject} · asked {wt.errorCount}x
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {progress.subjectBreakdown.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              All Subjects
            </Text>
            {progress.subjectBreakdown.map((sb) => {
              const icon = SUBJECT_ICONS[sb.subject.toLowerCase()] ?? "book";
              const maxXp = Math.max(...progress.subjectBreakdown.map((s) => s.xp), 1);
              const barPercent: `${number}%` = `${Math.round((sb.xp / maxXp) * 100)}%`;
              return (
                <View key={sb.subject} style={styles.subjectRow}>
                  <View style={[styles.subjectIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Ionicons name={icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.subjectDetails}>
                    <View style={styles.subjectMeta}>
                      <Text style={[styles.subjectName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                        {sb.subject}
                      </Text>
                      <Text style={[styles.subjectXp, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {sb.xp} XP · {sb.questionCount} Qs
                      </Text>
                    </View>
                    <View style={[styles.subjectTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.subjectFill, { width: barPercent, backgroundColor: colors.primary + "cc" }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {progress.badges.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Badges Earned
            </Text>
            <View style={styles.badgesGrid}>
              {progress.badges.map((badge) => {
                const icon = BADGE_ICONS[badge] ?? "star";
                const label = BADGE_LABELS[badge] ?? badge;
                return (
                  <View key={badge} style={[styles.badgeItem, { backgroundColor: colors.accent + "20" }]}>
                    <Ionicons name={icon} size={28} color={colors.accent} />
                    <Text style={[styles.badgeLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {progress.totalQuestions === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Start Your Journey
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Ask questions to earn XP, unlock badges, and level up!
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 26 },
  content: { paddingHorizontal: 16, gap: 16 },
  statsCard: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 22 },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, height: 40 },
  levelRow: { flexDirection: "row", alignItems: "center" },
  levelInfo: { flex: 1 },
  levelText: { fontSize: 16 },
  xpText: { fontSize: 13, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  section: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 16 },
  sectionTitle: { fontSize: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  subjectIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  subjectDetails: { flex: 1, gap: 6 },
  subjectMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subjectName: { fontSize: 14 },
  subjectXp: { fontSize: 12 },
  subjectTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  subjectFill: { height: "100%", borderRadius: 3 },
  weakTopicRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  weakDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  weakTopicInfo: { flex: 1 },
  weakTopicName: { fontSize: 14 },
  weakTopicMeta: { fontSize: 12, marginTop: 2 },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeItem: {
    alignItems: "center", gap: 6, padding: 14, borderRadius: 16, minWidth: 90,
  },
  badgeLabel: { fontSize: 12, textAlign: "center" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
