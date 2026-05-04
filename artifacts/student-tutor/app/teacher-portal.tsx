import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Platform, ActivityIndicator, Alert, KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";

function getBaseUrl() { return process.env.EXPO_PUBLIC_API_URL ?? ""; }

interface Teacher { id: number; name: string; email: string; }
interface Classroom { id: number; name: string; grade: string; subject: string; inviteCode: string; }

export default function TeacherPortalScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [token, setToken] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"classrooms" | "upload" | "broadcast">("classrooms");
  const [summaryText, setSummaryText] = useState("");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  React.useEffect(() => {
    AsyncStorage.getItem("tiva_teacher_token").then(async (saved) => {
      if (saved) {
        const teacherData = await AsyncStorage.getItem("tiva_teacher_data");
        if (teacherData) {
          setToken(saved);
          setTeacher(JSON.parse(teacherData));
          loadClassrooms(saved);
        }
      }
    });
  }, []);

  const loadClassrooms = useCallback(async (t: string) => {
    try {
      const resp = await fetch(`${getBaseUrl()}/api/teacher/classrooms`, {
        headers: { "x-teacher-token": t },
      });
      if (resp.ok) setClassrooms(await resp.json());
    } catch { /* ignore */ }
  }, []);

  const handleAuth = useCallback(async () => {
    if (!email || !password) { Alert.alert("Error", "Email and password required"); return; }
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/teacher/login" : "/api/teacher/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register") { body.name = name; }

      const resp = await fetch(`${getBaseUrl()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();

      if (!resp.ok) { Alert.alert("Error", data.error ?? "Auth failed"); return; }

      if (mode === "login") {
        await AsyncStorage.setItem("tiva_teacher_token", data.token);
        await AsyncStorage.setItem("tiva_teacher_data", JSON.stringify(data.teacher));
        setToken(data.token);
        setTeacher(data.teacher);
        loadClassrooms(data.token);
      } else {
        Alert.alert("Registered!", "Now please login.");
        setMode("login");
      }
    } catch {
      Alert.alert("Error", "Could not connect. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [email, password, name, mode, loadClassrooms]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("tiva_teacher_token");
    await AsyncStorage.removeItem("tiva_teacher_data");
    setToken(null); setTeacher(null); setClassrooms([]);
  }, []);

  const postSummary = useCallback(async () => {
    if (!token || !selectedClassroom || !summaryText.trim()) {
      Alert.alert("Error", "Select a classroom and write a summary"); return;
    }
    const selected = classrooms.find((c) => c.id === selectedClassroom);
    try {
      const resp = await fetch(`${getBaseUrl()}/api/teacher/lesson-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-teacher-token": token },
        body: JSON.stringify({ classroomId: selectedClassroom, subject: selected?.subject, summary: summaryText }),
      });
      if (resp.ok) {
        Alert.alert("Posted!", "Today's lesson summary has been saved for your students.");
        setSummaryText("");
      }
    } catch { Alert.alert("Error", "Could not post summary"); }
  }, [token, selectedClassroom, summaryText, classrooms]);

  const sendBroadcast = useCallback(async () => {
    if (!token || !broadcastTitle || !broadcastMsg) {
      Alert.alert("Error", "Title and message required"); return;
    }
    try {
      const resp = await fetch(`${getBaseUrl()}/api/teacher/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-teacher-token": token },
        body: JSON.stringify({ classroomId: selectedClassroom, title: broadcastTitle, message: broadcastMsg, link: broadcastLink || undefined, type: broadcastLink ? "live_session" : "announcement" }),
      });
      if (resp.ok) {
        Alert.alert("Sent!", "Broadcast sent to your students.");
        setBroadcastTitle(""); setBroadcastMsg(""); setBroadcastLink("");
      }
    } catch { Alert.alert("Error", "Could not send broadcast"); }
  }, [token, broadcastTitle, broadcastMsg, broadcastLink, selectedClassroom]);

  if (!token || !teacher) {
    return (
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding">
        <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Teacher Portal</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="school" size={40} color={colors.primary} style={{ alignSelf: "center" }} />
            <Text style={[styles.authTitle, { color: colors.foreground }]}>{mode === "login" ? "Teacher Login" : "Register as Teacher"}</Text>
            {mode === "register" && (
              <TextInput style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Full Name" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
            )}
            <TextInput style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Email" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail}
              keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Password" placeholderTextColor={colors.mutedForeground} value={password} onChangeText={setPassword}
              secureTextEntry />
            <TouchableOpacity style={[styles.authBtn, { backgroundColor: colors.primary }]} onPress={handleAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authBtnText}>{mode === "login" ? "Login" : "Register"}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <Text style={[styles.switchText, { color: colors.primary }]}>
                {mode === "login" ? "Don't have an account? Register" : "Already registered? Login"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Teacher Portal</Text>
          <Text style={[{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }]}>{teacher.name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.backBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["classrooms", "upload", "broadcast"] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === "classrooms" ? "Classes" : tab === "upload" ? "Lesson" : "Broadcast"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
        {activeTab === "classrooms" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Classrooms</Text>
            {classrooms.length === 0 && (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[{ color: colors.mutedForeground }]}>No classrooms yet. Create one below.</Text>
              </View>
            )}
            {classrooms.map((c) => (
              <View key={c.id} style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.className, { color: colors.foreground }]}>{c.name}</Text>
                <Text style={[{ color: colors.mutedForeground, fontSize: 13 }]}>{c.grade} · {c.subject}</Text>
                <View style={[styles.inviteRow, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="link" size={14} color={colors.primary} />
                  <Text style={[styles.inviteCode, { color: colors.primary }]}>Invite Code: {c.inviteCode}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === "upload" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Post Today's Lesson</Text>
            <Text style={[{ color: colors.mutedForeground, fontSize: 13 }]}>Students can ask "What was taught today?" and get this summary.</Text>
            {classrooms.length > 0 && (
              <View style={styles.pillRow}>
                {classrooms.map((c) => (
                  <TouchableOpacity key={c.id} onPress={() => setSelectedClassroom(c.id)}
                    style={[styles.pill, { backgroundColor: selectedClassroom === c.id ? colors.primary : colors.secondary }]}>
                    <Text style={[{ color: selectedClassroom === c.id ? "#fff" : colors.foreground, fontSize: 13 }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Write what was taught today... (topics, key points, homework given)"
              placeholderTextColor={colors.mutedForeground}
              value={summaryText}
              onChangeText={setSummaryText}
              multiline
              numberOfLines={6}
            />
            <TouchableOpacity style={[styles.authBtn, { backgroundColor: colors.primary }]} onPress={postSummary}>
              <Text style={styles.authBtnText}>Post Lesson Summary</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === "broadcast" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Send Broadcast</Text>
            {classrooms.length > 0 && (
              <View style={styles.pillRow}>
                <TouchableOpacity onPress={() => setSelectedClassroom(null)}
                  style={[styles.pill, { backgroundColor: selectedClassroom === null ? colors.primary : colors.secondary }]}>
                  <Text style={[{ color: selectedClassroom === null ? "#fff" : colors.foreground, fontSize: 13 }]}>All Classes</Text>
                </TouchableOpacity>
                {classrooms.map((c) => (
                  <TouchableOpacity key={c.id} onPress={() => setSelectedClassroom(c.id)}
                    style={[styles.pill, { backgroundColor: selectedClassroom === c.id ? colors.primary : colors.secondary }]}>
                    <Text style={[{ color: selectedClassroom === c.id ? "#fff" : colors.foreground, fontSize: 13 }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Title (e.g. Live Session Tonight 8PM)" placeholderTextColor={colors.mutedForeground}
              value={broadcastTitle} onChangeText={setBroadcastTitle} />
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Message to your students..."
              placeholderTextColor={colors.mutedForeground}
              value={broadcastMsg}
              onChangeText={setBroadcastMsg}
              multiline
              numberOfLines={4}
            />
            <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Live session link (optional)" placeholderTextColor={colors.mutedForeground}
              value={broadcastLink} onChangeText={setBroadcastLink} />
            <TouchableOpacity style={[styles.authBtn, { backgroundColor: "#f72585" }]} onPress={sendBroadcast}>
              <Text style={styles.authBtnText}>Send Broadcast</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 40, padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  authCard: { padding: 24, borderRadius: 16, borderWidth: 1, gap: 14 },
  authTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  input: { padding: 14, borderRadius: 10, borderWidth: 1, fontSize: 15 },
  textArea: { padding: 14, borderRadius: 10, borderWidth: 1, fontSize: 15, minHeight: 120, textAlignVertical: "top" },
  authBtn: { padding: 16, borderRadius: 12, alignItems: "center" },
  authBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  switchText: { textAlign: "center", fontSize: 14, fontWeight: "500" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  classCard: { padding: 14, borderRadius: 12, borderWidth: 1, gap: 6 },
  className: { fontSize: 16, fontWeight: "600" },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 4 },
  inviteCode: { fontSize: 13, fontWeight: "600", letterSpacing: 1 },
  emptyCard: { padding: 20, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
});
