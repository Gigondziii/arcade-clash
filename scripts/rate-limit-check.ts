// Standalone verification script for sliding-window rate limiting & socket event protection.
// Run: npx tsx scripts/rate-limit-check.ts

import { checkSocketRateLimit, globalRateLimiter } from "../packages/server/src/utils/rateLimiter.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("rate-limit-check");

// ---------------------------------------------------------------------------
// Test 1: Sliding Window Rate Limiter Basics
// ---------------------------------------------------------------------------
console.log("\nTest 1: Sliding Window Rate Limiter Core Logic");

const testKey = "test_endpoint:ip_127_0_0_1";
globalRateLimiter.resetKey(testKey);

// 3 requests allowed in 1000ms window
const res1 = globalRateLimiter.checkRateLimit(testKey, 3, 1000);
const res2 = globalRateLimiter.checkRateLimit(testKey, 3, 1000);
const res3 = globalRateLimiter.checkRateLimit(testKey, 3, 1000);
const res4 = globalRateLimiter.checkRateLimit(testKey, 3, 1000); // Exceeds threshold

check("Req 1 allowed", res1.allowed && res1.remaining === 2);
check("Req 2 allowed", res2.allowed && res2.remaining === 1);
check("Req 3 allowed", res3.allowed && res3.remaining === 0);
check("Req 4 rejected (rate limit threshold enforced)", !res4.allowed && res4.retryAfterMs > 0);

// ---------------------------------------------------------------------------
// Test 2: Category-Specific Rate Limits
// ---------------------------------------------------------------------------
console.log("\nTest 2: Category-Specific Rate Limits");

// Auth Limiter: Max 5 reqs / 60s
const authKey = "auth_test:ip_1.2.3.4";
globalRateLimiter.resetKey(authKey);
for (let i = 0; i < 5; i++) {
  globalRateLimiter.checkRateLimit(authKey, 5, 60_000);
}
const authExceeded = globalRateLimiter.checkRateLimit(authKey, 5, 60_000);
check("Auth endpoint rejects 6th attempt within 60s window", !authExceeded.allowed);

// Wallet Mutation Limiter: Max 10 reqs / 60s
const walletKey = "wallet_test:usr_100";
globalRateLimiter.resetKey(walletKey);
for (let i = 0; i < 10; i++) {
  globalRateLimiter.checkRateLimit(walletKey, 10, 60_000);
}
const walletExceeded = globalRateLimiter.checkRateLimit(walletKey, 10, 60_000);
check("Wallet mutation endpoint rejects 11th transaction within 60s window", !walletExceeded.allowed);

// Social Limiter: Max 15 reqs / 60s
const socialKey = "social_test:usr_200";
globalRateLimiter.resetKey(socialKey);
for (let i = 0; i < 15; i++) {
  globalRateLimiter.checkRateLimit(socialKey, 15, 60_000);
}
const socialExceeded = globalRateLimiter.checkRateLimit(socialKey, 15, 60_000);
check("Friend endpoint rejects 16th social action within 60s window", !socialExceeded.allowed);

// Match History Limiter: Max 30 reqs / 60s
const historyKey = "history_test:usr_300";
globalRateLimiter.resetKey(historyKey);
for (let i = 0; i < 30; i++) {
  globalRateLimiter.checkRateLimit(historyKey, 30, 60_000);
}
const historyExceeded = globalRateLimiter.checkRateLimit(historyKey, 30, 60_000);
check("Match history endpoint rejects 31st query within 60s window", !historyExceeded.allowed);

// ---------------------------------------------------------------------------
// Test 3: Socket.IO Event Rate Limiting
// ---------------------------------------------------------------------------
console.log("\nTest 3: Socket.IO Event Rate Limiting");

const socketId = "sock_test_999";
// joinQueue limit: max 6 / 10s
for (let i = 0; i < 6; i++) {
  checkSocketRateLimit(socketId, "joinQueue", 6, 10_000);
}
const socketQueueExceeded = !checkSocketRateLimit(socketId, "joinQueue", 6, 10_000);
check("Socket joinQueue event rejects 7th emission within 10s window", socketQueueExceeded);

// submitScore limit: max 2 / 5s
const submitSocketId = "sock_submit_888";
checkSocketRateLimit(submitSocketId, "submitScore", 2, 5_000);
checkSocketRateLimit(submitSocketId, "submitScore", 2, 5_000);
const scoreExceeded = !checkSocketRateLimit(submitSocketId, "submitScore", 2, 5_000);
check("Socket submitScore event rejects 3rd emission within 5s window", scoreExceeded);

// ---------------------------------------------------------------------------
// Test 4: Legitimate Usage Non-Interference
// ---------------------------------------------------------------------------
console.log("\nTest 4: Legitimate Usage Non-Interference");

const legitUserKey = "legit_test:usr_normal";
globalRateLimiter.resetKey(legitUserKey);
const legit1 = globalRateLimiter.checkRateLimit(legitUserKey, 120, 60_000);
const legit2 = globalRateLimiter.checkRateLimit(legitUserKey, 120, 60_000);
check("Legitimate requests well under rate threshold pass unimpeded", legit1.allowed && legit2.allowed);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll rate-limit checks passed.`);
