import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const dubbingProjects = mysqlTable("dubbing_projects", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sourceUrl: text("sourceUrl"),
  durationMs: int("durationMs"),
  sourceLanguage: varchar("sourceLanguage", { length: 16 }).default("en"),
  targetLanguage: varchar("targetLanguage", { length: 16 }).default("cmn-CN"),
  waveformJson: text("waveformJson"),
  status: mysqlEnum("status", ["draft", "transcribing", "editing", "processing", "ready", "failed"]).default("draft").notNull(),
  backgroundGain: int("backgroundGain").default(82).notNull(),
  voiceGain: int("voiceGain").default(100).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const dubbingSegments = mysqlTable("dubbing_segments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  segmentIndex: int("segmentIndex").notNull(),
  startMs: int("startMs").notNull(),
  endMs: int("endMs").notNull(),
  speaker: varchar("speaker", { length: 64 }).notNull(),
  sourceText: text("sourceText").notNull(),
  targetText: text("targetText").notNull(),
  voicePreset: varchar("voicePreset", { length: 64 }),
  voiceGain: int("voiceGain").default(100).notNull(),
  confidence: int("confidence"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const processingJobs = mysqlTable("processing_jobs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  kind: mysqlEnum("kind", ["transcribe", "translate", "separate", "synthesize", "mix", "export"]).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
  progress: int("progress").default(0).notNull(),
  message: text("message"),
  resultUrl: text("resultUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectVersions = mysqlTable("project_versions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  snapshotJson: text("snapshotJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const uploadSessions = mysqlTable("upload_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  totalBytes: int("totalBytes").notNull(),
  chunkSize: int("chunkSize").notNull(),
  totalParts: int("totalParts").notNull(),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  finalUrl: text("finalUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const uploadParts = mysqlTable("upload_parts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  partIndex: int("partIndex").notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  storageKey: text("storageKey").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const exportJobs = mysqlTable("export_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  projectId: int("projectId").notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["queued", "running", "completed", "cancelled", "failed"]).default("queued").notNull(),
  progress: int("progress").default(0).notNull(),
  resultUrl: text("resultUrl"),
  message: text("message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DubbingProject = typeof dubbingProjects.$inferSelect;
export type DubbingSegment = typeof dubbingSegments.$inferSelect;
export type ProcessingJob = typeof processingJobs.$inferSelect;
export type ProjectVersion = typeof projectVersions.$inferSelect;
export type UploadSession = typeof uploadSessions.$inferSelect;
export type UploadPart = typeof uploadParts.$inferSelect;
export type ExportJob = typeof exportJobs.$inferSelect;
