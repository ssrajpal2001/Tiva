import cron from "node-cron";
import { db } from "@workspace/db";
import { studentProgressTable } from "@workspace/db/schema";
import { lt } from "drizzle-orm";
import { logger } from "../lib/logger";

export function startCronJobs() {
  // Check for inactive students every hour and log (push notifications need Firebase key)
  cron.schedule("0 * * * *", async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const inactive = await db.select().from(studentProgressTable)
        .where(lt(studentProgressTable.lastActiveAt, oneDayAgo));
      if (inactive.length > 0) {
        logger.info({ count: inactive.length }, "Students inactive > 24h (push notifications need Firebase config)");
      }
    } catch (err) {
      logger.error({ err }, "Cron: inactive check failed");
    }
  });

  // Daily streak health check at midnight
  cron.schedule("0 0 * * *", async () => {
    logger.info("Daily cron: streak check running");
    // Streaks are self-healing via progress routes — this is a monitoring hook
  });

  logger.info("Cron jobs started");
}
