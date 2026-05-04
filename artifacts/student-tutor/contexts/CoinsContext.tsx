import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useState, useCallback } from "react";

interface CoinTransaction {
  id: number;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

interface CoinsContextType {
  balance: number;
  recentTransactions: CoinTransaction[];
  awardCoins: (deviceId: string, amount: number, reason: string, referenceId?: string) => Promise<void>;
  spendCoins: (deviceId: string, itemId: string) => Promise<{ success: boolean; message?: string }>;
  refreshBalance: (deviceId: string) => Promise<void>;
}

const CoinsContext = createContext<CoinsContextType>({
  balance: 0,
  recentTransactions: [],
  awardCoins: async () => {},
  spendCoins: async () => ({ success: false }),
  refreshBalance: async () => {},
});

const STORAGE_KEY = "tiva_coins_balance";

function getBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? "";
}

export function CoinsProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<CoinTransaction[]>([]);

  const refreshBalance = useCallback(async (deviceId: string) => {
    try {
      const resp = await fetch(`${getBaseUrl()}/api/coins/${encodeURIComponent(deviceId)}`);
      if (resp.ok) {
        const data = await resp.json() as { balance: number; transactions: CoinTransaction[] };
        setBalance(data.balance);
        setRecentTransactions(data.transactions ?? []);
        await AsyncStorage.setItem(STORAGE_KEY, String(data.balance));
      }
    } catch {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) setBalance(parseInt(cached, 10));
    }
  }, []);

  const awardCoins = useCallback(async (deviceId: string, amount: number, reason: string, referenceId?: string) => {
    try {
      const resp = await fetch(`${getBaseUrl()}/api/coins/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, amount, reason, referenceId }),
      });
      if (resp.ok) {
        const data = await resp.json() as { balance: number };
        setBalance(data.balance);
        await AsyncStorage.setItem(STORAGE_KEY, String(data.balance));
      }
    } catch {
      // silently fail — coins can be reconciled on next refresh
    }
  }, []);

  const spendCoins = useCallback(async (deviceId: string, itemId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const resp = await fetch(`${getBaseUrl()}/api/coins/spend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, itemId }),
      });
      const data = await resp.json() as { success?: boolean; balance?: number; error?: string };
      if (resp.ok && data.success) {
        setBalance(data.balance ?? balance);
        await AsyncStorage.setItem(STORAGE_KEY, String(data.balance ?? balance));
        return { success: true };
      }
      return { success: false, message: data.error ?? "Purchase failed" };
    } catch {
      return { success: false, message: "Network error" };
    }
  }, [balance]);

  return (
    <CoinsContext.Provider value={{ balance, recentTransactions, awardCoins, spendCoins, refreshBalance }}>
      {children}
    </CoinsContext.Provider>
  );
}

export function useCoins() {
  return useContext(CoinsContext);
}
