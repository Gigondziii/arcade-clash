import type { CorsOptions } from "cors";

// Environment-driven origin allowlist helper
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS ?? process.env.CLIENT_ORIGIN;
  const parsedOrigins = envOrigins
    ? envOrigins.split(",").map((o) => o.trim()).filter((o) => o.length > 0)
    : [];

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    // Development default origins
    const devDefaults = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];
    return Array.from(new Set([...devDefaults, ...parsedOrigins]));
  }

  // Production fallback if no ALLOWED_ORIGINS specified
  if (parsedOrigins.length === 0) {
    return ["https://fugluck.com", "https://www.fugluck.com", "https://staging.fugluck.com"];
  }

  return parsedOrigins;
}

export function isOriginAllowed(origin: string | undefined): boolean {
  // Allow non-browser / same-origin requests without an Origin header
  if (!origin) return true;

  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy violation: Origin '${origin}' is not allowed.`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Idempotency-Key",
    "Accept",
    "Origin",
  ],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400, // 24 hours preflight cache
};

export const socketIoCorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Socket.IO CORS policy violation: Origin '${origin}' is not allowed.`));
    }
  },
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Idempotency-Key",
    "Accept",
    "Origin",
  ],
};
