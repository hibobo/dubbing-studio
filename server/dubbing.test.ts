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
});
