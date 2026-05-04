import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";
import { useProgress } from "@/contexts/ProgressContext";
import { useTheme } from "@/contexts/ThemeContext";

const VOICE_OPTIONS = [
  { id: "friendly", label: "Friendly Teacher", icon: "happy" as const, description: "Warm, encouraging, approachable" },
  { id: "strict", label: "Strict Coach", icon: "fitness" as const, description: "Focused, precise, demanding" },
  { id: "motivational", label: "Motivational Coach", icon: "trophy" as const, description: "Energetic, inspiring, upbeat" },
];

const LEVEL_NAMES = [
  "Beginner", "Explorer", "Learner", "Student", "Scholar",
  "Thinker", "Expert", "Champion", "Genius", "Master", "Legend",
];

export default function ProfileTab() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateVoicePersonality } = useProfile();
  const { progress } = useProgress();
  const { themeMode, setThemeMode } = useTheme();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const levelName = LEVEL_NAMES[Math.min(progress.level - 1, LEVEL_NAMES.length - 1)] ?? "Master";

  if (!profile?.onboarded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad + 24, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="person-circle-outline" size={64} color={colors.mutedForeground} />
        <Text style={[styles.noProfileText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Complete onboarding to set up your profile
        </Text>
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/onboarding")}
        >
          <Text style={[styles.editBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
            Get Started
          </Text>
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
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.profileCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{profile.name}</Text>
            <Text style={[styles.profileGrade, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {profile.grade} · {profile.board}
            </Text>
            <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.levelBadgeText, { color: colors.primaryForeground, fontFamily: "Inter_500Medium" }]}>
                Level {progress.level} · {levelName}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/onboarding")}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Subjects</Text>
          <View style={styles.subjectsWrap}>
            {profile.subjects.map((subject) => (
              <View key={subject} style={[styles.subjectTag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.subjectTagText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{subject}</Text>
              </View>
            ))}
          </View>

          {profile.goal && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.infoCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Goal</Text>
              <Text style={[styles.goalText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.goal}</Text>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.infoCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Language</Text>
          <Text style={[styles.goalText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {profile.preferredLanguage ?? "English"}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Tutor Voice
          </Text>
          <Text style={[styles.voiceSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Choose your tutor personality
          </Text>
          {VOICE_OPTIONS.map((opt) => {
            const isSelected = (profile.voicePersonality ?? "friendly") === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.voiceOption,
                  {
                    backgroundColor: isSelected ? colors.primary + "15" : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => updateVoicePersonality(opt.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={opt.icon} size={22} color={isSelected ? colors.primary : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.voiceLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{opt.label}</Text>
                  <Text style={[styles.voiceDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{opt.description}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            Display
          </Text>
          <Text style={[styles.voiceSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Choose your preferred theme
          </Text>
          {(["light", "dark", "system"] as const).map((mode) => {
            const isSelected = themeMode === mode;
            const iconMap = { light: "sunny" as const, dark: "moon" as const, system: "contrast" as const };
            const labelMap = { light: "Light", dark: "Dark", system: "Auto (System)" };
            const descMap = { light: "Always light mode", dark: "Always dark mode", system: "Follow system setting" };
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.voiceOption,
                  {
                    backgroundColor: isSelected ? colors.primary + "15" : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setThemeMode(mode)}
                activeOpacity={0.7}
              >
                <Ionicons name={iconMap[mode]} size={22} color={isSelected ? colors.primary : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.voiceLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{labelMap[mode]}</Text>
                  <Text style={[styles.voiceDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{descMap[mode]}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoCardTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            More Features
          </Text>
          {[
            { icon: "book" as const, label: "Textbook Library", route: "/textbooks" },
            { icon: "document-text" as const, label: "Previous Year Papers", route: "/prev-year-papers" },
            { icon: "school" as const, label: "Teacher Portal", route: "/teacher-portal" },
            { icon: "gift" as const, label: "Refer & Earn", route: "/referral" },
          ].map((item) => (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, { borderColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color={colors.primary} />
              <Text style={[styles.navItemText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{progress.totalXp}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Total XP</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{progress.streak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Streak</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{progress.badges.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>Badges</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 26 },
  content: { paddingHorizontal: 16, gap: 16 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    padding: 20, borderRadius: 20, borderWidth: 1,
  },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 24 },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 20 },
  profileGrade: { fontSize: 14 },
  levelBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50, marginTop: 4 },
  levelBadgeText: { fontSize: 12 },
  infoCard: { borderRadius: 20, padding: 20, borderWidth: 1, gap: 10 },
  infoCardTitle: { fontSize: 14 },
  subjectsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjectTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1 },
  subjectTagText: { fontSize: 13 },
  divider: { height: 1 },
  goalText: { fontSize: 14, lineHeight: 20 },
  voiceSubtitle: { fontSize: 13, marginTop: -4 },
  voiceOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  voiceLabel: { fontSize: 14 },
  voiceDesc: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: "row", borderRadius: 20, padding: 20, borderWidth: 1 },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24 },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1 },
  noProfileText: { fontSize: 15, textAlign: "center", marginVertical: 16 },
  editBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 50 },
  editBtnText: { fontSize: 15 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  navItemText: { flex: 1, fontSize: 15 },
});
