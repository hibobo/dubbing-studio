import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createProjectForOwner, enqueueProcessingJob, getProjectForOwner, listProjectVersions, listProjects, restoreProjectVersion, saveProjectVersion, updateMixForOwner, updateSegmentForOwner } from "./db";

const segmentPatch = z.object({
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().positive().optional(),
  speaker: z.string().min(1).max(64).optional(),
  sourceText: z.string().min(1).optional(),
  targetText: z.string().min(1).optional(),
  voicePreset: z.string().max(64).nullable().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => listProjects(ctx.user.openId)),
    create: protectedProcedure.input(z.object({ name: z.string().min(1).max(255), sourceUrl: z.string().min(1).max(2000).optional(), durationMs: z.number().int().positive().optional(), sourceLanguage: z.string().max(16).optional(), targetLanguage: z.string().max(16).optional(), waveformJson: z.string().max(2_000_000).optional(), segments: z.array(z.object({ id: z.number().int().positive(), startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(), role: z.string().min(1).max(64), source: z.string().min(1), target: z.string().min(1), confidence: z.number().int().min(0).max(100).optional() })).max(500).optional() })).mutation(({ ctx, input }) => createProjectForOwner({ ...input, ownerOpenId: ctx.user.openId })),
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => getProjectForOwner(input.projectId, ctx.user.openId)),
    updateSegment: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), segmentId: z.number().int().positive(), patch: segmentPatch })).mutation(({ ctx, input }) => updateSegmentForOwner(input.projectId, ctx.user.openId, input.segmentId, input.patch)),
    updateMix: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), backgroundGain: z.number().int().min(0).max(140), voiceGain: z.number().int().min(0).max(160) })).mutation(({ ctx, input }) => updateMixForOwner(input.projectId, ctx.user.openId, input.backgroundGain, input.voiceGain)),
    versions: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => listProjectVersions(input.projectId, ctx.user.openId)),
    saveVersion: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), label: z.string().min(1).max(255), snapshotJson: z.string().max(2_000_000) })).mutation(({ ctx, input }) => saveProjectVersion(input.projectId, ctx.user.openId, input.label, input.snapshotJson)),
    restoreVersion: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), versionId: z.number().int().positive() })).mutation(({ ctx, input }) => restoreProjectVersion(input.projectId, ctx.user.openId, input.versionId)),
    enqueue: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), kind: z.enum(["transcribe", "translate", "separate", "synthesize", "mix", "export"]) })).mutation(({ ctx, input }) => enqueueProcessingJob(input.projectId, ctx.user.openId, input.kind)),
  }),
});

export type AppRouter = typeof appRouter;
