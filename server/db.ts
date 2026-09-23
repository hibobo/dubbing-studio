import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  DubbingSegment,
  InsertUser,
  dubbingProjects,
  dubbingSegments,
  projectVersions,
  processingJobs,
  uploadParts,
  uploadSessions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProjects(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dubbingProjects).where(eq(dubbingProjects.ownerOpenId, ownerOpenId)).orderBy(asc(dubbingProjects.updatedAt));
}

export async function createProjectForOwner(input: { ownerOpenId: string; name: string; sourceUrl?: string; durationMs?: number; sourceLanguage?: string; targetLanguage?: string; waveformJson?: string; segments?: Array<{ id: number; startMs: number; endMs: number; role: string; source: string; target: string; confidence?: number }> }) {
  const db = await getDb();
  if (!db) return undefined;
  const inserted = await db.insert(dubbingProjects).values({ ownerOpenId: input.ownerOpenId, name: input.name, sourceUrl: input.sourceUrl, durationMs: input.durationMs, sourceLanguage: input.sourceLanguage ?? "en", targetLanguage: input.targetLanguage ?? "cmn-CN", waveformJson: input.waveformJson, status: "draft" });
  const projectId = Number(inserted[0].insertId);
  if (input.segments?.length) {
    await db.insert(dubbingSegments).values(input.segments.map((segment, index) => ({ projectId, segmentIndex: index, startMs: segment.startMs, endMs: segment.endMs, speaker: segment.role, sourceText: segment.source, targetText: segment.target, confidence: segment.confidence ?? null })));
  }
  const result = await db.select().from(dubbingProjects).where(eq(dubbingProjects.id, projectId)).limit(1);
  return result[0];
}

export async function getProjectForOwner(projectId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const projectRows = await db.select().from(dubbingProjects).where(and(eq(dubbingProjects.id, projectId), eq(dubbingProjects.ownerOpenId, ownerOpenId))).limit(1);
  const project = projectRows[0];
  if (!project) return undefined;
  const segments = await db.select().from(dubbingSegments).where(eq(dubbingSegments.projectId, projectId)).orderBy(asc(dubbingSegments.segmentIndex));
  return { project, segments };
}

export async function saveProjectVersion(projectId: number, ownerOpenId: string, label: string, snapshotJson: string) {
  const db = await getDb();
  if (!db) return undefined;
  const project = await db.select({ id: dubbingProjects.id }).from(dubbingProjects).where(and(eq(dubbingProjects.id, projectId), eq(dubbingProjects.ownerOpenId, ownerOpenId))).limit(1);
  if (!project[0]) return undefined;
  const inserted = await db.insert(projectVersions).values({ projectId, ownerOpenId, label, snapshotJson });
  return Number(inserted[0].insertId);
}

export async function listProjectVersions(projectId: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectVersions).where(and(eq(projectVersions.projectId, projectId), eq(projectVersions.ownerOpenId, ownerOpenId))).orderBy(asc(projectVersions.createdAt));
}

export async function restoreProjectVersion(projectId: number, ownerOpenId: string, versionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const version = await db.select().from(projectVersions).where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, projectId), eq(projectVersions.ownerOpenId, ownerOpenId))).limit(1);
  if (!version[0]) return undefined;
  const snapshot = JSON.parse(version[0].snapshotJson) as { segments?: Array<{ id: number; startMs: number; endMs: number; speaker: string; sourceText: string; targetText: string; voicePreset?: string | null }> };
  if (snapshot.segments) {
    for (const segment of snapshot.segments) {
      await db.update(dubbingSegments).set({ startMs: segment.startMs, endMs: segment.endMs, speaker: segment.speaker, sourceText: segment.sourceText, targetText: segment.targetText, voicePreset: segment.voicePreset ?? null, updatedAt: new Date() }).where(and(eq(dubbingSegments.id, segment.id), eq(dubbingSegments.projectId, projectId)));
    }
  }
  return getProjectForOwner(projectId, ownerOpenId);
}

export async function updateSegmentForOwner(projectId: number, ownerOpenId: string, segmentId: number, patch: Partial<Pick<DubbingSegment, "startMs" | "endMs" | "speaker" | "sourceText" | "targetText" | "voicePreset">>) {
  const db = await getDb();
  if (!db) return undefined;
  const project = await db.select({ id: dubbingProjects.id }).from(dubbingProjects).where(and(eq(dubbingProjects.id, projectId), eq(dubbingProjects.ownerOpenId, ownerOpenId))).limit(1);
  if (!project[0]) return undefined;
  await db.update(dubbingSegments).set({ ...patch, updatedAt: new Date() }).where(and(eq(dubbingSegments.id, segmentId), eq(dubbingSegments.projectId, projectId)));
  const result = await db.select().from(dubbingSegments).where(eq(dubbingSegments.id, segmentId)).limit(1);
  return result[0];
}

export async function updateMixForOwner(projectId: number, ownerOpenId: string, backgroundGain: number, voiceGain: number) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(dubbingProjects).set({ backgroundGain, voiceGain, updatedAt: new Date() }).where(and(eq(dubbingProjects.id, projectId), eq(dubbingProjects.ownerOpenId, ownerOpenId)));
  const result = await db.select().from(dubbingProjects).where(eq(dubbingProjects.id, projectId)).limit(1);
  return result[0];
}

export async function enqueueProcessingJob(projectId: number, ownerOpenId: string, kind: "transcribe" | "translate" | "separate" | "synthesize" | "mix" | "export") {
  const db = await getDb();
  if (!db) return undefined;
  const project = await db.select({ id: dubbingProjects.id }).from(dubbingProjects).where(and(eq(dubbingProjects.id, projectId), eq(dubbingProjects.ownerOpenId, ownerOpenId))).limit(1);
  if (!project[0]) return undefined;
  const inserted = await db.insert(processingJobs).values({ projectId, kind, status: "queued", progress: 0, message: "等待处理节点接收" });
  return inserted;
}

export async function createUploadSession(input: { id: string; ownerOpenId: string; fileName: string; contentType: string; totalBytes: number; chunkSize: number; totalParts: number }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(uploadSessions).values({ ...input, status: "active" });
  return db.select().from(uploadSessions).where(eq(uploadSessions.id, input.id)).limit(1).then((rows) => rows[0]);
}

export async function getUploadSessionForOwner(id: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const session = await db.select().from(uploadSessions).where(and(eq(uploadSessions.id, id), eq(uploadSessions.ownerOpenId, ownerOpenId))).limit(1);
  if (!session[0]) return undefined;
  const parts = await db.select().from(uploadParts).where(eq(uploadParts.sessionId, id)).orderBy(asc(uploadParts.partIndex));
  return { session: session[0], parts };
}

export async function saveUploadPart(input: { sessionId: string; partIndex: number; sizeBytes: number; storageKey: string }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.delete(uploadParts).where(and(eq(uploadParts.sessionId, input.sessionId), eq(uploadParts.partIndex, input.partIndex)));
  await db.insert(uploadParts).values(input);
  return input;
}

export async function completeUploadSession(id: string, ownerOpenId: string, finalUrl: string) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(uploadSessions).set({ status: "completed", finalUrl, updatedAt: new Date() }).where(and(eq(uploadSessions.id, id), eq(uploadSessions.ownerOpenId, ownerOpenId)));
  return getUploadSessionForOwner(id, ownerOpenId);
}

export async function cancelUploadSession(id: string, ownerOpenId: string) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(uploadSessions).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(uploadSessions.id, id), eq(uploadSessions.ownerOpenId, ownerOpenId)));
  return true;
}
