import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storagePut } from "../storage";
import { sdk } from "./sdk";
import { cancelUploadSession, completeUploadSession, createUploadSession, getUploadSessionForOwner, saveUploadPart } from "../db";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const uploadRoot = path.join("/tmp", "dubbing-studio-uploads");
  const authenticate = async (req: express.Request) => {
    try { return await sdk.authenticateRequest(req); } catch { return null; }
  };
  app.post("/api/upload/video", express.raw({ type: ["video/*", "application/octet-stream"], limit: "500mb" }), async (req, res) => {
    try {
      let user = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        user = null;
      }
      if (!user) {
        res.status(401).json({ error: "登录后才能上传视频" });
        return;
      }
      const fileName = String(req.header("x-file-name") || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
      const contentType = req.header("content-type") || "video/mp4";
      const result = await storagePut(`${user.openId}/videos/${fileName}`, req.body as Buffer, contentType);
      res.json(result);
    } catch (error) {
      console.error("[Upload] Video upload failed:", error);
      res.status(500).json({ error: "视频上传失败，请稍后重试" });
    }
  });
  app.put("/api/upload/session/:id/part/:partIndex", express.raw({ type: ["application/octet-stream", "video/*"], limit: "16mb" }), async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: "登录后才能上传" }); return; }
    const sessionId = String(req.params.id);
    const partIndex = Number(req.params.partIndex);
    const current = await getUploadSessionForOwner(sessionId, user.openId);
    if (!current || current.session.status !== "active" || !Number.isInteger(partIndex) || partIndex < 0 || partIndex >= current.session.totalParts) { res.status(404).json({ error: "上传会话不存在或已结束" }); return; }
    const bytes = req.body as Buffer;
    const dir = path.join(uploadRoot, sessionId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${partIndex}.part`), bytes);
    await saveUploadPart({ sessionId, partIndex, sizeBytes: bytes.length, storageKey: path.join(dir, `${partIndex}.part`) });
    res.json({ sessionId, partIndex, sizeBytes: bytes.length });
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/upload/session", async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: "登录后才能上传" }); return; }
    const { fileName, contentType = "video/mp4", totalBytes, chunkSize = 8 * 1024 * 1024 } = req.body as { fileName?: string; contentType?: string; totalBytes?: number; chunkSize?: number };
    if (!fileName || typeof totalBytes !== "number" || !Number.isInteger(totalBytes) || totalBytes <= 0 || typeof chunkSize !== "number" || !Number.isInteger(chunkSize) || chunkSize < 1024 * 1024 || chunkSize > 16 * 1024 * 1024) { res.status(400).json({ error: "上传参数无效" }); return; }
    const safeTotalBytes = totalBytes as number;
    const safeChunkSize = chunkSize as number;
    const id = randomUUID().replace(/-/g, "");
    const session = await createUploadSession({ id, ownerOpenId: user.openId, fileName: String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_"), contentType, totalBytes: safeTotalBytes, chunkSize: safeChunkSize, totalParts: Math.ceil(safeTotalBytes / safeChunkSize) });
    res.json({ session, uploadedParts: [] });
  });
  app.get("/api/upload/session/:id", async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: "登录后才能查看上传" }); return; }
    const result = await getUploadSessionForOwner(String(req.params.id), user.openId);
    if (!result) { res.status(404).json({ error: "上传会话不存在" }); return; }
    const files: string[] = await readdir(path.join(uploadRoot, result.session.id)).catch(() => [] as string[]);
    res.json({ session: result.session, uploadedParts: files.map((file) => Number(file.split(".")[0])).filter(Number.isInteger) });
  });
  app.post("/api/upload/session/:id/complete", async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: "登录后才能完成上传" }); return; }
    const current = await getUploadSessionForOwner(String(req.params.id), user.openId);
    if (!current || current.session.status !== "active") { res.status(404).json({ error: "上传会话不存在或已结束" }); return; }
    const dir = path.join(uploadRoot, current.session.id);
    const files: string[] = await readdir(dir).catch(() => [] as string[]);
    const expected = Array.from({ length: current.session.totalParts }, (_, index) => `${index}.part`);
    if (expected.some((file) => !files.includes(file))) { res.status(409).json({ error: "仍有分片未上传", uploadedParts: files.map((file) => Number(file.split(".")[0])).filter(Number.isInteger) }); return; }
    const chunks = await Promise.all(expected.map((file) => readFile(path.join(dir, file))));
    const result = await storagePut(`${user.openId}/videos/${current.session.fileName}`, Buffer.concat(chunks), current.session.contentType);
    const completed = await completeUploadSession(current.session.id, user.openId, result.url);
    await rm(dir, { recursive: true, force: true });
    res.json({ ...result, session: completed?.session });
  });
  app.delete("/api/upload/session/:id", async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: "登录后才能取消上传" }); return; }
    await cancelUploadSession(String(req.params.id), user.openId);
    await rm(path.join(uploadRoot, String(req.params.id)), { recursive: true, force: true });
    res.json({ success: true });
  });
  app.post("/api/processing/preview", async (req, res) => {
    const user = await authenticate(req);
    if (!user) { res.status(401).json({ error: "登录后才能生成试听" }); return; }
    if (!ENV.processingNodeUrl) { res.status(503).json({ error: "尚未配置处理节点", code: "PROCESSING_NODE_NOT_CONFIGURED" }); return; }
    try {
      const upstream = await fetch(`${ENV.processingNodeUrl.replace(/\/$/, "")}/preview`, { method: "POST", headers: { "content-type": "application/json", ...(ENV.processingNodeToken ? { authorization: `Bearer ${ENV.processingNodeToken}` } : {}) }, body: JSON.stringify({ ...req.body, ownerOpenId: user.openId }) });
      const payload = await upstream.text();
      res.status(upstream.status).type("application/json").send(payload);
    } catch (error) {
      console.error("[Processing] Preview node failed:", error);
      res.status(502).json({ error: "处理节点暂时不可用" });
    }
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
