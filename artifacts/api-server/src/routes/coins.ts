import { Router } from "express";
import { db } from "@workspace/db";
import { coinLedgerTable, studentProgressTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

const STORE_ITEMS = [
  { id: "theme_ocean", name: "Ocean Theme", description: "Cool blue ocean tones", cost: 50, type: "theme" },
  { id: "theme_sunset", name: "Sunset Theme", description: "Warm sunset gradient", cost: 50, type: "theme" },
  { id: "theme_forest", name: "Forest Theme", description: "Earthy green tones", cost: 50, type: "theme" },
  { id: "theme_galaxy", name: "Galaxy Theme", description: "Deep space purple", cost: 100, type: "theme" },
  { id: "unlock_prev_year", name: "Previous Year Papers", description: "Unlock past exam papers", cost: 200, type: "feature" },
  { id: "hint_pack_5", name: "5 Hints Pack", description: "Get 5 extra hints for tests", cost: 30, type: "consumable" },
];

async function getBalance(deviceId: string): Promise<number> {
  const entries = await db.select().from(coinLedgerTable)
    .where(eq(coinLedgerTable.deviceId, deviceId))
    .orderBy(desc(coinLedgerTable.createdAt))
    .limit(1);

  return entries[0]?.balanceAfter ?? 0;
}

router.get("/coins/:deviceId", async (req, res) => {
  const { deviceId } = req.params;

  const balance = await getBalance(deviceId);
  const recent = await db.select().from(coinLedgerTable)
    .where(eq(coinLedgerTable.deviceId, deviceId))
    .orderBy(desc(coinLedgerTable.createdAt))
    .limit(20);

  res.json({ balance, transactions: recent });
});

router.post("/coins/award", async (req, res) => {
  const { deviceId, amount, reason, referenceId } = req.body as {
    deviceId: string;
    amount: number;
    reason: string;
    referenceId?: string;
  };

  if (!deviceId || !amount || !reason) {
    res.status(400).json({ error: "deviceId, amount, reason required" });
    return;
  }

  const currentBalance = await getBalance(deviceId);
  const newBalance = currentBalance + amount;

  await db.insert(coinLedgerTable).values({
    deviceId,
    delta: amount,
    reason,
    referenceId: referenceId ?? null,
    balanceAfter: newBalance,
  });

  res.json({ balance: newBalance, awarded: amount });
});

router.post("/coins/spend", async (req, res) => {
  const { deviceId, itemId } = req.body as { deviceId: string; itemId: string };

  if (!deviceId || !itemId) {
    res.status(400).json({ error: "deviceId and itemId required" });
    return;
  }

  const item = STORE_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const currentBalance = await getBalance(deviceId);
  if (currentBalance < item.cost) {
    res.status(400).json({ error: "Insufficient coins", balance: currentBalance, cost: item.cost });
    return;
  }

  const newBalance = currentBalance - item.cost;
  await db.insert(coinLedgerTable).values({
    deviceId,
    delta: -item.cost,
    reason: "theme_purchase",
    referenceId: itemId,
    balanceAfter: newBalance,
  });

  res.json({ success: true, balance: newBalance, item });
});

router.get("/coins/store", (_req, res) => {
  res.json(STORE_ITEMS);
});

export default router;
