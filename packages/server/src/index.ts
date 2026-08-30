import "dotenv/config";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { attachMatchmaking, type MatchmakingServer } from "./matchmaking";
import { accountRouter } from "./routes/account";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { friendsRouter } from "./routes/friends";
import { matchesRouter } from "./routes/matches";
import { walletRouter } from "./routes/wallet";

import { corsOptions } from "./config/cors";
import { enforceStartupConfig } from "./config/startup";
import { ensureUserSchema, pool } from "./db/client";
import { logger, requestLoggerMiddleware } from "./utils/safeLogger";

// Enforce mandatory configuration at boot
enforceStartupConfig();

const app = express();

// Trust reverse proxies (Vercel, Render, Railway, Cloudflare) for accurate client IP & HTTPS detection
const trustProxyValue = process.env.TRUST_PROXY;
if (trustProxyValue === "false") {
  app.set("trust proxy", false);
} else if (trustProxyValue === "true") {
  app.set("trust proxy", true);
} else if (trustProxyValue) {
  app.set("trust proxy", Number(trustProxyValue) || 1);
} else {
  // Default to 1 hop behind hosted reverse proxy
  app.set("trust proxy", 1);
}

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(requestLoggerMiddleware);

app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/admin", adminRouter);

const healthPayload = () => ({
  ok: true,
  status: "healthy",
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || "development",
  version: "0.0.1",
});

app.get("/health", (_req, res) => {
  res.json(healthPayload());
});

app.get("/api/health", async (_req, res) => {
  let dbStatus = "unknown";
  try {
    const check = await pool.query("SELECT 1 as ping");
    dbStatus = check.rows.length > 0 ? "connected" : "unavailable";
  } catch (err: any) {
    logger.warn("[health] database connectivity check failed:", err?.message || err);
    dbStatus = "unavailable";
  }
  res.json({
    ...healthPayload(),
    database: dbStatus,
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: "Fugluck API Server",
    status: "online",
    health: "/api/health",
    endpoints: ["/api/auth", "/api/account", "/api/wallet", "/api/friends", "/api/matches"],
  });
});

// Last-resort safety net — Express 5 forwards rejected async handler
// promises here automatically, so a DB hiccup returns a 500 instead of
// crashing the process (this is exactly what happened under Express 4
// during initial testing, before the upgrade).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

const httpServer = createServer(app);
const io: MatchmakingServer = attachMatchmaking(httpServer);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST || "0.0.0.0";

let isShuttingDown = false;

async function handleGracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[server] received ${signal}, initiating graceful shutdown...`);

  // 10-second hard fallback timeout to avoid hanging indefinitely
  const forceExitTimeout = setTimeout(() => {
    logger.error("[server] graceful shutdown timed out after 10s, forcing exit.");
    process.exit(1);
  }, 10_000);
  forceExitTimeout.unref();

  try {
    // 1. Close Socket.IO connections
    logger.info("[server] closing WebSocket connections...");
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });

    // 2. Stop accepting new HTTP requests
    logger.info("[server] stopping HTTP server...");
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });

    // 3. Close database connection pool
    logger.info("[server] closing database pool...");
    await pool.end();

    logger.info("[server] graceful shutdown complete.");
    process.exit(0);
  } catch (error) {
    logger.error("[server] error during graceful shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void handleGracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void handleGracefulShutdown("SIGINT");
});

async function startServer() {
  try {
    await ensureUserSchema();
  } catch (err) {
    logger.warn("[server] ensureUserSchema non-fatal boot notice:", err);
  }

  httpServer.listen(port, host, () => {
    logger.info(`[server] listening on http://${host}:${port}`);
  });
}

void startServer().catch((error) => {
  logger.error("[server] startup failed:", error);
  process.exitCode = 1;
});

