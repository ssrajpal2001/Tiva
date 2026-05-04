import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useProfile } from "@/contexts/ProfileContext";
import { useCoins } from "@/contexts/CoinsContext";

interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: string;
}

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

const ITEM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  theme: "color-palette-outline",
  feature: "lock-open-outline",
  consumable: "bulb-outline",
};

const ITEM_COLORS: Record<string, string> = {
  theme: "#7209b7",
  feature: "#4361ee",
  consumable: "#f59e0b",
};

export default function StoreScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { balance, refreshBalance, spendCoins } = useCoins();

  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    fetch(`${getBaseUrl()}/api/coins/store`)
      .then((r) => r.json())
      .then((data) => setItems(data as StoreItem[]))
      .finally(() => setLoading(false));

    if (profile?.deviceId) {
      refreshBalance(profile.deviceId);
    }
  }, [profile?.deviceId, refreshBalance]);

  const purchase = useCallback(async (item: StoreItem) => {
    if (!profile?.deviceId) return;

    if (balance < item.cost) {
      Alert.alert(
        "Not enough coins",
        `You need ${item.cost - balance} more TiVa Coins to unlock this.`,
      );
      return;
    }

    Alert.alert(
      `Unlock ${item.name}?`,
      `This will cost ${item.cost} TiVa Coins. You have ${balance} coins.`,
      [
        { text: "Cancel" },
        {
          text: "Unlock",
          onPress: async () => {
            setPurchasing(item.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await spendCoins(profile.deviceId, item.id);
            setPurchasing(null);
            if (result.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Unlocked!", `${item.name} is now active.`);
            } else {
              Alert.alert("Failed", result.message ?? "Could not complete purchase.");
            }
          },
        },
      ],
    );
  }, [profile?.deviceId, balance, spendCoins]);

  const themes = items.filter((i) => i.type === "theme");
  const features = items.filter((i) => i.type !== "theme");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>TiVa Store</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Balance */}
      <View style={[styles.balanceCard, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b" }]}>
        <Ionicons name="logo-bitcoin" size={32} color="#f59e0b" />
        <View>
          <Text style={[styles.balanceAmount, { color: "#f59e0b" }]}>{balance}</Text>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>TiVa Coins</Text>
        </View>
        <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
          Earn by completing tests and daily login
        </Text>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}

      {/* Themes */}
      {themes.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Themes</Text>
          <View style={styles.grid}>
            {themes.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => purchase(item)}
                disabled={!!purchasing}
              >
                <View style={[styles.itemIcon, { backgroundColor: ITEM_COLORS[item.type]! + "20" }]}>
                  {purchasing === item.id
                    ? <ActivityIndicator color={ITEM_COLORS[item.type]} size="small" />
                    : <Ionicons name={ITEM_ICONS[item.type] ?? "pricetag-outline"} size={24} color={ITEM_COLORS[item.type]} />}
                </View>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.itemDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
                <View style={[styles.costBadge, { backgroundColor: "#f59e0b20" }]}>
                  <Ionicons name="logo-bitcoin" size={12} color="#f59e0b" />
                  <Text style={[styles.costText, { color: "#f59e0b" }]}>{item.cost}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Features & Consumables */}
      {features.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Power-Ups</Text>
          {features.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => purchase(item)}
              disabled={!!purchasing}
            >
              <View style={[styles.featureIcon, { backgroundColor: ITEM_COLORS[item.type]! + "20" }]}>
                {purchasing === item.id
                  ? <ActivityIndicator color={ITEM_COLORS[item.type]} size="small" />
                  : <Ionicons name={ITEM_ICONS[item.type] ?? "pricetag-outline"} size={22} color={ITEM_COLORS[item.type]} />}
              </View>
              <View style={styles.featureInfo}>
                <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.itemDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
              </View>
              <View style={[styles.costBadge, { backgroundColor: "#f59e0b20" }]}>
                <Ionicons name="logo-bitcoin" size={12} color="#f59e0b" />
                <Text style={[styles.costText, { color: "#f59e0b" }]}>{item.cost}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* How to earn */}
      <View style={[styles.earnCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.earnTitle, { color: colors.foreground }]}>How to earn coins</Text>
        <View style={styles.earnRow}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={[styles.earnText, { color: colors.mutedForeground }]}>Complete a test: 5–20 coins</Text>
        </View>
        <View style={styles.earnRow}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={[styles.earnText, { color: colors.mutedForeground }]}>Daily login bonus: 5 coins</Text>
        </View>
        <View style={styles.earnRow}>
          <Ionicons name="checkmark-circle" size={18} color="#10b981" />
          <Text style={[styles.earnText, { color: colors.mutedForeground }]}>Perfect score (100%): Bonus 20 coins</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { width: 40, padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: "700", textAlign: "center" },
  balanceCard: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  balanceAmount: { fontSize: 36, fontWeight: "800" },
  balanceLabel: { fontSize: 13 },
  balanceHint: { fontSize: 12, flex: 1 },
  section: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  itemCard: {
    width: "47%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  itemIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  itemDesc: { fontSize: 11, textAlign: "center" },
  costBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  costText: { fontSize: 13, fontWeight: "700" },
  featureCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  featureInfo: { flex: 1, gap: 2 },
  earnCard: {
    margin: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  earnTitle: { fontSize: 15, fontWeight: "600" },
  earnRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  earnText: { fontSize: 13 },
});
