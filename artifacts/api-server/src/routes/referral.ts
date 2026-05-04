import { Router } from "express";
import { db } from "@workspace/db";
import { referralsTable, coinLedgerTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

const REFERRAL_REWARD = 50; // coins for referrer when someone joins

async function getBalance(deviceId: string): Promise<number> {
  const entries = await db.select().from(coinLedgerTable)
    .where(eq(coinLedgerTable.deviceId, deviceId))
    .orderBy(desc(coinLedgerTable.createdAt))
    .limit(1);
  return entries[0]?.balanceAfter ?? 0;
}

router.post("/referral/generate", async (req, res) => {
  const { deviceId } = req.body as { deviceId: string };
  if (!deviceId) { res.status(400).json({ error: "deviceId required" }); return; }

  // Check if referral code already exists
  const existing = await db.select().from(referralsTable)
    .where(eq(referralsTable.referrerDeviceId, deviceId));
  if (existing.length > 0) {
    res.json({ code: existing[0]!.referralCode });
    return;
  }

  const code = deviceId.substring(0, 6).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  const [referral] = await db.insert(referralsTable)
    .values({ referrerDeviceId: deviceId, referralCode: code })
    .returning();
  res.json({ code: referral!.referralCode });
});

router.post("/referral/use", async (req, res) => {
  const { deviceId, code } = req.body as { deviceId: string; code: string };
  if (!deviceId || !code) { res.status(400).json({ error: "deviceId and code required" }); return; }

  const [referral] = await db.select().from(referralsTable)
    .where(eq(referralsTable.referralCode, code.toUpperCase()));

  if (!referral) { res.status(404).json({ error: "Invalid referral code" }); return; }
  if (referral.referredDeviceId) { res.status(400).json({ error: "Code already used" }); return; }
  if (referral.referrerDeviceId === deviceId) { res.status(400).json({ error: "Cannot use your own code" }); return; }

  // Mark referral as used
  await db.update(referralsTable)
    .set({ referredDeviceId: deviceId, usedAt: new Date() })
    .where(eq(referralsTable.id, referral.id));

  // Award coins to referrer
  if (!referral.coinsAwarded) {
    const balance = await getBalance(referral.referrerDeviceId);
    await db.insert(coinLedgerTable).values({
      deviceId: referral.referrerDeviceId,
      delta: REFERRAL_REWARD,
      reason: "referral",
      referenceId: deviceId,
      balanceAfter: balance + REFERRAL_REWARD,
    });
    await db.update(referralsTable)
      .set({ coinsAwarded: true })
      .where(eq(referralsTable.id, referral.id));
  }

  res.json({ success: true, message: `You joined via referral! Your friend earned ${REFERRAL_REWARD} coins.` });
});

router.get("/referral/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  const referrals = await db.select().from(referralsTable)
    .where(eq(referralsTable.referrerDeviceId, deviceId));
  const successfulReferrals = referrals.filter((r) => r.referredDeviceId);
  res.json({
    code: referrals[0]?.referralCode ?? null,
    totalReferrals: successfulReferrals.length,
    coinsEarned: successfulReferrals.length * REFERRAL_REWARD,
  });
});

export default router;
