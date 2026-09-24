import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCaller() {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "dubbing-test-user",
    email: "dubbing@example.com",
    name: "Dubbing Test",
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

describe("dubbing project procedures", () => {
  it("rejects invalid project identifiers before touching the processing node", async () => {
    const caller = createCaller();
    await expect(caller.projects.enqueue({ projectId: 0, kind: "mix" })).rejects.toThrow();
  });

  it("rejects an invalid mix range", async () => {
    const caller = createCaller();
    await expect(caller.projects.updateMix({ projectId: 1, backgroundGain: -1, voiceGain: 100 })).rejects.toThrow();
  });

  it("requires a project name when creating an upload project", async () => {
    const caller = createCaller();
    await expect(caller.projects.create({ name: "" })).rejects.toThrow();
  });

  it("requires a bounded snapshot payload for version saves", async () => {
    const caller = createCaller();
    await expect(caller.projects.saveVersion({ projectId: 1, label: "", snapshotJson: "{}" })).rejects.toThrow();
  });

  it("rejects remote version operations with invalid identifiers", async () => {
    const caller = createCaller();
    await expect(caller.projects.versions({ projectId: 0 })).rejects.toThrow();
    await expect(caller.projects.restoreVersion({ projectId: 1, versionId: 0 })).rejects.toThrow();
  });

  it("bounds per-segment voice gain", async () => {
    const caller = createCaller();
    await expect(caller.projects.updateSegment({ projectId: 1, segmentId: 1, patch: { voiceGain: 161 } })).rejects.toThrow();
    await expect(caller.projects.updateSegment({ projectId: 1, segmentId: 1, patch: { voiceGain: -1 } })).rejects.toThrow();
  });

  it("bounds initial segment voice gain when creating a project", async () => {
    const caller = createCaller();
    await expect(caller.projects.create({ name: "test", segments: [{ id: 1, startMs: 0, endMs: 1000, role: "narrator", source: "a", target: "b", voiceGain: 161 }] })).rejects.toThrow();
  });
});
