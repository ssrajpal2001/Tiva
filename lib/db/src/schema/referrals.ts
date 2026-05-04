import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerDeviceId: text("referrer_device_id").notNull(),
  referralCode: text("referral_code").notNull().unique(),
  referredDeviceId: text("referred_device_id"),
  coinsAwarded: boolean("coins_awarded").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  usedAt: timestamp("used_at"),
});

export const insertReferralSchema = createInsertSchema(referralsTable).omit({ id: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referralsTable.$inferSelect;
