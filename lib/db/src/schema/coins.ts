import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coinLedgerTable = pgTable("coin_ledger", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  delta: integer("delta").notNull(), // positive = earn, negative = spend
  reason: text("reason").notNull(), // "test_complete"|"chapter_complete"|"referral"|"theme_purchase"|"daily_login"
  referenceId: text("reference_id"), // testId, themeId, etc.
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCoinLedgerSchema = createInsertSchema(coinLedgerTable).omit({ id: true });
export type InsertCoinLedger = z.infer<typeof insertCoinLedgerSchema>;
export type CoinLedger = typeof coinLedgerTable.$inferSelect;
