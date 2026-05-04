import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentProfilesTable, studentProgressTable, featureFlagsTable,
  teachersTable, schoolsTable, coinLedgerTable, callSessionsTable, testsTable
} from "@workspace/db/schema";
import { desc, count, sum } from "drizzle-orm";

const router = Router();

const ADMIN_KEY = process.env["ADMIN_API_KEY"] ?? "tiva-admin-2024";

function requireAdmin(req: import("express").Request, res: import("express").Response): boolean {
  const key = req.headers["x-admin-key"] as string;
  if (key !== ADMIN_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const profiles = await db.select().from(studentProfilesTable).orderBy(desc(studentProfilesTable.createdAt)).limit(100);
  res.json(profiles);
});

router.get("/admin/analytics", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const [profileCount] = await db.select({ count: count() }).from(studentProfilesTable);
  const [teacherCount] = await db.select({ count: count() }).from(teachersTable);
  const [schoolCount] = await db.select({ count: count() }).from(schoolsTable);
  const [testCount] = await db.select({ count: count() }).from(testsTable);
  const [callCount] = await db.select({ count: count() }).from(callSessionsTable);
  const [coinTotal] = await db.select({ total: sum(coinLedgerTable.delta) }).from(coinLedgerTable);
  res.json({
    students: profileCount?.count ?? 0,
    teachers: teacherCount?.count ?? 0,
    schools: schoolCount?.count ?? 0,
    testsCompleted: testCount?.count ?? 0,
    callsMade: callCount?.count ?? 0,
    totalCoinsCirculating: coinTotal?.total ?? 0,
  });
});

router.get("/admin/features", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const flags = await db.select().from(featureFlagsTable);
  res.json(flags);
});

router.post("/admin/features", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { key, enabledForFree, enabledForPremium, description } = req.body as {
    key: string; enabledForFree: boolean; enabledForPremium: boolean; description?: string;
  };
  const [flag] = await db.insert(featureFlagsTable)
    .values({ key, enabledForFree, enabledForPremium, description })
    .onConflictDoUpdate({ target: featureFlagsTable.key, set: { enabledForFree, enabledForPremium, updatedAt: new Date() } })
    .returning();
  res.json(flag);
});

router.get("/admin/teachers", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const teachers = await db.select().from(teachersTable).orderBy(desc(teachersTable.createdAt)).limit(100);
  res.json(teachers.map((t) => ({ id: t.id, name: t.name, email: t.email, subject: t.subject, grade: t.grade, createdAt: t.createdAt })));
});

router.get("/admin/schools", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const schools = await db.select().from(schoolsTable).orderBy(desc(schoolsTable.createdAt)).limit(100);
  res.json(schools.map((s) => ({ id: s.id, name: s.name, email: s.email, board: s.board, subscriptionTier: s.subscriptionTier })));
});

export default router;
