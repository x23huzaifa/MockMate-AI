/**
 * MockMate AI — server entry point.
 *
 * Single-port setup: Express serves both the versioned REST API (/api/v1/...)
 * and the client. In development, Vite runs as Express middleware (with HMR).
 * In production (NODE_ENV=production), the prebuilt client in dist/ is served
 * statically. Unknown /api routes return JSON 404s; everything else falls back
 * to index.html for client-side routing.
 */
import cookieParser from "cookie-parser";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env.js";
import { securityHeaders } from "../middleware/securityHeaders.js";
import authRoutes from "../routes/auth.js";
import cvsRoutes from "../routes/cvs.js";
import interviewsRoutes from "../routes/interviews.js";
import jobProfilesRoutes from "../routes/jobProfiles.js";
import settingsRoutes from "../routes/settings.js";
import adminRoutes from "../routes/admin.js";
import progressRoutes from "../routes/progress.js";
import contactRoutes from "../routes/contact.js";

const app = express();
app.use(securityHeaders);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// API routes (v1)
// ---------------------------------------------------------------------------

app.get("/api/v1/health", (_req, res) => {
  res.json({ ok: true, service: "mockmate-ai" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cvs", cvsRoutes);
app.use("/api/v1/job-profiles", jobProfilesRoutes);
app.use("/api/v1/interviews", interviewsRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/progress", progressRoutes);
app.use("/api/v1/contact", contactRoutes);

// Unknown /api routes → JSON 404. Registered after all real API routes and
// before the SPA fallback so API consumers never receive HTML.
app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

// ---------------------------------------------------------------------------
// Client serving
// ---------------------------------------------------------------------------

async function mountClient(): Promise<void> {
  if (ENV.NODE_ENV === "production") {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    // SPA fallback (Express 4/5 compatible: plain middleware, no "*" route).
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);

  const indexHtml = fs.readFileSync(
    path.resolve(process.cwd(), "index.html"),
    "utf-8"
  );
  // SPA fallback for page routes in dev; Vite transforms index.html with HMR.
  app.use(async (req, res, next) => {
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, indexHtml);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}

async function start(): Promise<void> {
  // Importing ENV already validated required variables; a missing secret
  // throws here with a clear message instead of failing cryptically later.
  await mountClient();
  app.listen(ENV.PORT, () => {
    console.log(
      `[mockmate-ai] Server running on http://localhost:${ENV.PORT}/ (${ENV.NODE_ENV})`
    );
  });
}

start().catch((err) => {
  console.error("[mockmate-ai] Failed to start:", err);
  process.exit(1);
});
