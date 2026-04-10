import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface SubjectProgress {
  subject: string;
  questionCount: number;
  xp: number;
  timeMinutes: number;
}

export interface ProgressData {
  totalXp: number;
  level: number;
  streak: number;
  totalQuestions: number;
  totalTimeMinutes: number;
  subjectBreakdown: SubjectProgress[];
  badges: string[];
  lastActiveAt?: string;
  lastStreakDate?: string;
}

interface ProgressContextType {
  progress: ProgressData;
  awardXp: (xp: number, subject: string, timeMinutes?: number) => void;
  refreshFromBackend: (deviceId: string) => Promise<void>;
}

const DEFAULT_PROGRESS: ProgressData = {
  totalXp: 0,
  level: 1,
  streak: 0,
  totalQuestions: 0,
  totalTimeMinutes: 0,
  subjectBreakdown: [],
  badges: [],
};

const STORAGE_KEY = "student_progress_v2";

const ProgressContext = createContext<ProgressContextType>({
  progress: DEFAULT_PROGRESS,
  awardXp: () => {},
  refreshFromBackend: async () => {},
});

const BADGE_CONDITIONS = [
  { id: "first_question", label: "First Step", check: (p: ProgressData) => p.totalQuestions >= 1 },
  { id: "ten_questions", label: "Getting Started", check: (p: ProgressData) => p.totalQuestions >= 10 },
  { id: "fifty_questions", label: "Curious Mind", check: (p: ProgressData) => p.totalQuestions >= 50 },
  { id: "streak_3", label: "On Fire", check: (p: ProgressData) => p.streak >= 3 },
  { id: "streak_7", label: "Weekly Warrior", check: (p: ProgressData) => p.streak >= 7 },
  { id: "level_5", label: "Rising Scholar", check: (p: ProgressData) => p.level >= 5 },
  { id: "level_10", label: "Knowledge Seeker", check: (p: ProgressData) => p.level >= 10 },
  { id: "time_60", label: "Hour Scholar", check: (p: ProgressData) => p.totalTimeMinutes >= 60 },
  { id: "time_300", label: "Dedicated Learner", check: (p: ProgressData) => p.totalTimeMinutes >= 300 },
];

export const BADGE_LABELS: Record<string, string> = Object.fromEntries(BADGE_CONDITIONS.map((b) => [b.id, b.label]));

function computeLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

function normalizeBackendProgress(data: Record<string, unknown>): ProgressData {
  return {
    totalXp: (data["totalXp"] as number | undefined) ?? 0,
    level: (data["level"] as number | undefined) ?? computeLevel((data["totalXp"] as number | undefined) ?? 0),
    streak: (data["streak"] as number | undefined) ?? 0,
    totalQuestions: (data["totalQuestions"] as number | undefined) ?? 0,
    totalTimeMinutes: (data["totalTimeMinutes"] as number | undefined) ?? 0,
    subjectBreakdown: (data["subjectBreakdown"] as SubjectProgress[] | undefined) ?? [],
    badges: (data["badges"] as string[] | undefined) ?? [],
    lastActiveAt: (data["lastActiveAt"] as string | undefined),
    lastStreakDate: (data["lastStreakDate"] as string | undefined),
  };
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressData>(DEFAULT_PROGRESS);

  const persistProgress = useCallback(async (p: ProgressData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ProgressData;
          setProgress({ ...DEFAULT_PROGRESS, ...parsed });
        }
      } catch {
      }
    })();
  }, []);

  const refreshFromBackend = useCallback(async (deviceId: string) => {
    if (!deviceId) return;
    try {
      const response = await fetch(`${getBaseUrl()}/api/progress/${encodeURIComponent(deviceId)}`);
      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        const backendProgress = normalizeBackendProgress(data);
        setProgress(backendProgress);
        await persistProgress(backendProgress);
      }
    } catch {
    }
  }, [persistProgress]);

  const awardXp = useCallback((xp: number, subject: string, timeMinutes = 0) => {
    setProgress((prev) => {
      const newTotalXp = prev.totalXp + xp;
      const newLevel = computeLevel(newTotalXp);
      const newTotalQuestions = prev.totalQuestions + 1;
      const newTotalTimeMinutes = (prev.totalTimeMinutes ?? 0) + timeMinutes;

      const subjectBreakdown = [...(prev.subjectBreakdown ?? [])];
      const idx = subjectBreakdown.findIndex((s) => s.subject === subject);
      if (idx >= 0 && subjectBreakdown[idx]) {
        subjectBreakdown[idx] = {
          ...subjectBreakdown[idx]!,
          questionCount: (subjectBreakdown[idx]?.questionCount ?? 0) + 1,
          xp: (subjectBreakdown[idx]?.xp ?? 0) + xp,
          timeMinutes: (subjectBreakdown[idx]?.timeMinutes ?? 0) + timeMinutes,
        };
      } else {
        subjectBreakdown.push({ subject, questionCount: 1, xp, timeMinutes });
      }

      const today = new Date().toISOString().split("T")[0];
      let newStreak = prev.streak;
      if (prev.lastStreakDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        if (prev.lastStreakDate === yesterdayStr) {
          newStreak = prev.streak + 1;
        } else {
          newStreak = 1;
        }
      }

      const updated: ProgressData = {
        totalXp: newTotalXp,
        level: newLevel,
        streak: newStreak,
        totalQuestions: newTotalQuestions,
        totalTimeMinutes: newTotalTimeMinutes,
        subjectBreakdown,
        badges: prev.badges ?? [],
        lastActiveAt: new Date().toISOString(),
        lastStreakDate: today,
      };

      const newBadges = [...(updated.badges ?? [])];
      for (const badge of BADGE_CONDITIONS) {
        if (!newBadges.includes(badge.id) && badge.check(updated)) {
          newBadges.push(badge.id);
        }
      }
      updated.badges = newBadges;

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  return (
    <ProgressContext.Provider value={{ progress, awardXp, refreshFromBackend }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  return useContext(ProgressContext);
}
