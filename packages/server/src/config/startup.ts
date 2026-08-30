import { logger } from "../utils/safeLogger";

export type StartupValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateStartupConfig(env: NodeJS.ProcessEnv = process.env): StartupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Database URL Validation
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    errors.push("DATABASE_URL is required but not configured.");
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
        errors.push(`DATABASE_URL protocol must be postgres: or postgresql: (received '${parsed.protocol}')`);
      }
    } catch {
      errors.push("DATABASE_URL is not a valid PostgreSQL connection URI.");
    }
  }

  // 2. JWT Secret Validation
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length === 0) {
    errors.push("JWT_SECRET is required but not configured.");
  } else if (jwtSecret.length < 32 && env.NODE_ENV === "production") {
    warnings.push("JWT_SECRET should be at least 32 characters long in production/staging environments.");
  }

  // 3. Port Validation
  const port = env.PORT;
  if (port) {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`PORT must be an integer between 1 and 65535 (received '${port}').`);
    }
  }

  // 4. CORS Origins Warning
  const clientOrigin = env.CLIENT_ORIGIN;
  const allowedOrigins = env.ALLOWED_ORIGINS;
  if (env.NODE_ENV === "production" && !clientOrigin && !allowedOrigins) {
    warnings.push("Neither CLIENT_ORIGIN nor ALLOWED_ORIGINS is set. Falling back to default production domains.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function enforceStartupConfig(): void {
  const result = validateStartupConfig();

  for (const warning of result.warnings) {
    logger.warn(`[startup-config-warning] ${warning}`);
  }

  if (!result.valid) {
    for (const error of result.errors) {
      logger.error(`[startup-config-error] ${error}`);
    }
    throw new Error(
      `Startup configuration validation failed with ${result.errors.length} error(s):\n- ${result.errors.join("\n- ")}`,
    );
  }
}
