import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
  Share, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";
import { useCoins } from "@/contexts/CoinsContext";

function getBaseUrl() { return process.env.EXPO_PUBLIC_API_URL ?? ""; }

export default function ReferralScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { refreshBalance } = useCoins();

  const [code, setCode] = useState<string | null>(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enterCode, setEnterCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const loadReferral = useCallback(async () => {
    if (!profile?.deviceId) return;
    try {
      // Get existing code or generate one
      let resp = await fetch(`${getBaseUrl()}/api/referral/${profile.deviceId}`);
      let data = await resp.json();

      if (!data.code) {
        // Generate a code
        const genResp = await fetch(`${getBaseUrl()}/api/referral/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: profile.deviceId }),
        });
        data = await genResp.json();
      }

      setCode(data.code);
      setTotalReferrals(data.totalReferrals ?? 0);
      setCoinsEarned(data.coinsEarned ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [profile?.deviceId]);

  useEffect(() => { loadReferral(); }, [loadReferral]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const shareCode = useCallback(async () => {
    if (!code) return;
    await Share.share({
      message: `Join me on TiVa — the AI tutor that actually calls you! Use my referral code: ${code}\n\nDownload TiVa and start learning smarter. No more TV, only TiVa!`,
      title: "Join TiVa with my referral code",
    });
  }, [code]);

  const useCode = useCallback(async () => {
    if (!enterCode.trim() || !profile?.deviceId) return;
    setJoining(true);
    try {
      const resp = await fetch(`${getBaseUrl()}/api/referral/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: profile.deviceId, code: enterCode.trim() }),
      });
      const data = await resp.json();
      if (resp.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success!", data.message);
        setEnterCode("");
        refreshBalance(profile.deviceId);
      } else {
        Alert.alert("Error", data.error ?? "Invalid code");
      }
    } catch {
      Alert.alert("Error", "Could not apply code");
    } finally {
      setJoining(false);
    }
  }, [enterCode, profile?.deviceId, refreshBalance]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Refer & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: "#4361ee15", borderColor: "#4361ee" }]}>
          <Ionicons name="gift" size={48} color={colors.primary} />
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Earn 50 coins per referral!</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Share TiVa with friends. When they sign up using your code, you earn 50 TiVa Coins.
          </Text>
        </View>

        {/* Your code */}
        {loading ? <ActivityIndicator color={colors.primary} /> : (
          <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>Your Referral Code</Text>
            <View style={styles.codeRow}>
              <Text style={[styles.code, { color: colors.primary }]}>{code ?? "..."}</Text>
              <TouchableOpacity style={[styles.copyBtn, { backgroundColor: copied ? "#10b981" : colors.secondary }]} onPress={copyCode}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? "#fff" : colors.foreground} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={shareCode}>
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.shareBtnText}>Share with Friends</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{totalReferrals}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Friends Joined</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: "#f59e0b" }]}>{coinsEarned}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Coins Earned</Text>
          </View>
        </View>

        {/* Enter a code */}
        <View style={[styles.enterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.enterTitle, { color: colors.foreground }]}>Have a referral code?</Text>
          <Text style={[styles.enterSub, { color: colors.mutedForeground }]}>Enter your friend's code to credit them.</Text>
          <View style={styles.enterRow}>
            <TextInput
              style={[styles.enterInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Enter code (e.g. ABC123)"
              placeholderTextColor={colors.mutedForeground}
              value={enterCode}
              onChangeText={setEnterCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={[styles.enterBtn, { backgroundColor: colors.primary }]} onPress={useCode} disabled={joining}>
              {joining ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.enterBtnText}>Apply</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 40, padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  heroCard: { padding: 24, borderRadius: 16, borderWidth: 1.5, alignItems: "center", gap: 10 },
  heroTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  heroSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  codeCard: { padding: 20, borderRadius: 14, borderWidth: 1, gap: 14 },
  codeLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  code: { fontSize: 32, fontWeight: "800", letterSpacing: 4, flex: 1 },
  copyBtn: { padding: 10, borderRadius: 10 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12 },
  shareBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 12 },
  enterCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  enterTitle: { fontSize: 15, fontWeight: "600" },
  enterSub: { fontSize: 13 },
  enterRow: { flexDirection: "row", gap: 8 },
  enterInput: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 16, fontWeight: "600", letterSpacing: 2 },
  enterBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  enterBtnText: { color: "#fff", fontWeight: "700" },
});
