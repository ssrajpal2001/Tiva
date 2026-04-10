import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface StudentProfile {
  deviceId: string;
  name: string;
  grade: string;
  board: string;
  subjects: string[];
  goal?: string;
  preferredLanguage?: string;
  voicePersonality?: string;
  onboarded: boolean;
}

interface ProfileContextType {
  profile: StudentProfile | null;
  setProfile: (p: StudentProfile) => void;
  loading: boolean;
  updateVoicePersonality: (vp: string) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  setProfile: () => {},
  loading: true,
  updateVoicePersonality: () => {},
});

const STORAGE_KEY = "student_profile_v1";

function generateDeviceId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setProfileState(JSON.parse(raw));
        }
      } catch (_e) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setProfile = async (p: StudentProfile) => {
    const profileWithId = p.deviceId ? p : { ...p, deviceId: generateDeviceId() };
    setProfileState(profileWithId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profileWithId));
  };

  const updateVoicePersonality = async (vp: string) => {
    if (!profile) return;
    const updated = { ...profile, voicePersonality: vp };
    setProfileState(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    const baseUrl = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "";
    fetch(`${baseUrl}/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: updated.deviceId,
        name: updated.name,
        grade: updated.grade,
        board: updated.board,
        subjects: updated.subjects,
        goal: updated.goal ?? null,
        preferredLanguage: updated.preferredLanguage ?? "english",
        voicePersonality: vp,
      }),
    }).catch(() => {});
  };

  return (
    <ProfileContext.Provider value={{ profile, setProfile, loading, updateVoicePersonality }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
