import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { authRouter } from "./routes/auth";

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Last-resort safety net — Express 5 forwards rejected async handler
// promises here automatically, so a DB hiccup returns a 500 instead of
// crashing the process (this is exactly what happened under Express 4
// during initial testing, before the upgrade).
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
