import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { enqueueProcessingJob, getProjectForOwner, listProjects, updateMixForOwner, updateSegmentForOwner } from "./db";

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
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => getProjectForOwner(input.projectId, ctx.user.openId)),
    updateSegment: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), segmentId: z.number().int().positive(), patch: segmentPatch })).mutation(({ ctx, input }) => updateSegmentForOwner(input.projectId, ctx.user.openId, input.segmentId, input.patch)),
    updateMix: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), backgroundGain: z.number().int().min(0).max(140), voiceGain: z.number().int().min(0).max(160) })).mutation(({ ctx, input }) => updateMixForOwner(input.projectId, ctx.user.openId, input.backgroundGain, input.voiceGain)),
    enqueue: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), kind: z.enum(["transcribe", "translate", "separate", "synthesize", "mix", "export"]) })).mutation(({ ctx, input }) => enqueueProcessingJob(input.projectId, ctx.user.openId, input.kind)),
  }),
});

export type AppRouter = typeof appRouter;
