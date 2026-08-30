import type { Request, Response, NextFunction } from "express";

type RateLimiterRecord = {
  timestamps: number[];
};

class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimiterRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodically prune stale keys every 2 minutes so memory stays bounded
    this.cleanupInterval = setInterval(() => this.pruneStaleRecords(), 2 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out timestamps older than the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterMs = oldestInWindow ? oldestInWindow + windowMs - now : windowMs;
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(1000, retryAfterMs) };
    }

    record.timestamps.push(now);
    const remaining = maxRequests - record.timestamps.length;
    return { allowed: true, remaining, retryAfterMs: 0 };
  }

  public resetKey(key: string): void {
    this.records.delete(key);
  }

  private pruneStaleRecords(): void {
    const now = Date.now();
    const maxWindowMs = 15 * 60 * 1000; // prune entries inactive for >15 minutes
    for (const [key, record] of this.records.entries()) {
      if (record.timestamps.length === 0 || record.timestamps[record.timestamps.length - 1] < now - maxWindowMs) {
        this.records.delete(key);
      }
    }
  }
}

export const globalRateLimiter = new SlidingWindowRateLimiter();

export type RateLimiterOptions = {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
};

export function createRateLimiterMiddleware(options: RateLimiterOptions) {
  const { windowMs, maxRequests, message = "Too many requests. Please try again later.", keyGenerator } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = keyGenerator ? keyGenerator(req) : req.userId ? `usr:${req.userId}` : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const key = `${req.baseUrl}${req.path}:${clientKey}`;

    const { allowed, retryAfterMs } = globalRateLimiter.checkRateLimit(key, maxRequests, windowMs);

    if (!allowed) {
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

export function checkSocketRateLimit(socketId: string, eventName: string, maxRequests: number, windowMs: number): boolean {
  const key = `sock:${socketId}:${eventName}`;
  const { allowed } = globalRateLimiter.checkRateLimit(key, maxRequests, windowMs);
  return allowed;
}
