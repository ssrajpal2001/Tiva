import { Router } from "express";
import { db } from "@workspace/db";
import { schoolsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "tiva_school_salt").digest("hex");
}

router.post("/school/register", async (req, res) => {
  const { name, email, password, board, city } = req.body as {
    name: string; email: string; password: string; board?: string; city?: string;
  };
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, password required" });
    return;
  }
  const existing = await db.select().from(schoolsTable).where(eq(schoolsTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "School email already registered" });
    return;
  }
  const [school] = await db.insert(schoolsTable)
    .values({ name, email, passwordHash: hashPassword(password), board, city })
    .returning();
  res.status(201).json({ id: school!.id, name: school!.name, email: school!.email });
});

router.post("/school/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.email, email));
  if (!school || school.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = Buffer.from(`school:${school.id}:${Date.now()}`).toString("base64");
  res.json({ token, school: { id: school.id, name: school.name, subscriptionTier: school.subscriptionTier } });
});

router.get("/school/profile", async (req, res) => {
  const token = req.headers["x-school-token"] as string;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const schoolId = parseInt(decoded.split(":")[1] ?? "");
    const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, schoolId));
    if (!school) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: school.id, name: school.name, board: school.board, city: school.city, subscriptionTier: school.subscriptionTier, subscriptionValidUntil: school.subscriptionValidUntil });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
