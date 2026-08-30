# Fugluck — Staging Deployment Guide

This guide provides the complete, step-by-step procedure to deploy Fugluck to a **Public Staging Environment** for real-browser testing on actual domain names:
* **Frontend Web App**: `https://staging.fugluck.com` (Hosted on **Vercel**)
* **Backend API & WebSocket Server**: `https://api-staging.fugluck.com` (Hosted on **Render**)
* **Database**: Dedicated, isolated Staging PostgreSQL database

> [!IMPORTANT]
> **Staging Environment Safety Invariants:**
> 1. **This is NOT a real-money launch**: Real payments and withdrawals are completely disabled.
> 2. **Separate Database**: Staging **MUST NOT** connect to or modify production data. Always use a dedicated staging database.
> 3. **No Weakened Security**: HTTPS, HTTP-only Secure cookies, CSRF boundaries, password complexity, rate limits, and origin validation remain 100% strictly enforced.

---

## Architecture Overview

```
[ Browser / Desktop Player ]
             │
             ├──► https://staging.fugluck.com (Vercel Client / Static SPA)
             │
             └──► https://api-staging.fugluck.com (Render Node.js / Express 5 + Socket.IO)
                                  │
                                  ▼
             [ Dedicated Staging PostgreSQL Database (Neon / Supabase) ]
```

---

## Step-by-Step Staging Deployment

### STEP 1 — Create an Isolated Staging PostgreSQL Database

1. Log in to your PostgreSQL cloud provider (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or Render PostgreSQL).
2. Create a new database project named **`fugluck-staging`** (or a separate database on your cluster).
3. Copy the connection string URI. It will look like:
   ```
   postgresql://[user]:[password]@[host]:5432/[staging_db_name]?sslmode=require
   ```
4. Save this URI securely. You will use it as `DATABASE_URL` in the backend service.

---

### STEP 2 — Deploy the Backend Server on Render

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`arcadeclash`).
4. Configure the Web Service settings:
   * **Name**: `fugluck-server-staging`
   * **Region**: Choose the region closest to your database (e.g. `Ohio (US East)` or `Frankfurt (EU)`).
   * **Runtime**: `Node`
   * **Root Directory**: Leave blank (monorepo root).
   * **Build Command**:
     ```bash
     npm install --include=dev && npm run build:server
     ```
   * **Start Command**:
     ```bash
     npm run start:server
     ```
   * **Health Check Path**: `/health`
   * **Auto-Deploy**: `Yes`
5. Configure the **Environment Variables** in the Render UI:

| Variable Name | Value / Description | Sensitive? |
|---|---|---|
| `NODE_ENV` | `production` | No |
| `DATABASE_URL` | *Paste your Staging PostgreSQL URI from Step 1* | **YES (Secret)** |
| `JWT_SECRET` | *Generate a 64-character random hex string* (see below) | **YES (Secret)** |
| `CLIENT_ORIGIN` | `https://staging.fugluck.com` | No |
| `ALLOWED_ORIGINS` | `https://staging.fugluck.com` | No |
| `APP_URL` | `https://staging.fugluck.com` | No |
| `COOKIE_DOMAIN` | `.fugluck.com` | No |
| `COOKIE_SAMESITE` | `lax` | No |
| `TRUST_PROXY` | `1` | No |
| `ENABLE_DEV_DIAMOND_STUB` | `false` | No |
| `EMAIL_PROVIDER` | `logger` | No |
| `EMAIL_FROM` | `Fugluck Staging <no-reply@fugluck.com>` | No |

> [!TIP]
> **Generating a Secure JWT Secret:**
> You can generate a random 64-char key in any terminal with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

6. Click **Create Web Service**. Wait for the initial build and deployment to complete.
7. Render will provide a default URL (e.g. `https://fugluck-server-staging.onrender.com`).

---

### STEP 3 — Run Database Migrations on Staging

Before using the application, apply the official database migration chain (`0000` through `0007`) to your staging database:

1. In the Render Web Service dashboard, navigate to the **Shell** tab (or run locally pointed to your staging `DATABASE_URL`):
2. Run the migration command:
   ```bash
   npm run db:migrate
   ```
3. Verify that all tables, triggers, indexes, and initial platform records are created without errors.

---

### STEP 4 — Deploy the Frontend on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`arcadeclash`).
4. In the project setup configuration:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click *Edit* and select **`packages/client`**.
   * **Build Command**: `npm run build` (or leave default Vite build)
   * **Output Directory**: `dist`
   * **Install Command**: `npm install` (from monorepo root)
5. Add the **Environment Variables** in Vercel:

| Variable Name | Value |
|---|---|
| `VITE_API_URL` | `https://api-staging.fugluck.com` (or your Render URL until DNS is active) |
| `VITE_SUPABASE_URL` | *Your public Supabase project URL (optional)* |
| `VITE_SUPABASE_ANON_KEY` | *Your public Supabase anon key (optional)* |

6. Click **Deploy**.
7. Vercel will build the client and deploy it. SPA routes (`/profile`, `/terms`, `/help`, etc.) will route properly thanks to [`packages/client/vercel.json`](packages/client/vercel.json).

---

### STEP 5 — Configure Custom Domains & DNS Records

In your DNS Provider (Cloudflare, Namecheap, GoDaddy, AWS Route 53, etc.), add the following CNAME records:

| Record Type | Host / Name | Target / Points To | Notes |
|---|---|---|---|
| **CNAME** | `staging` | `cname.vercel-dns.com` | Frontend (Vercel) |
| **CNAME** | `api-staging` | `fugluck-server-staging.onrender.com` | Backend (Render) |

1. In Vercel Project Settings -> **Domains**, add `staging.fugluck.com`.
2. In Render Web Service Settings -> **Custom Domains**, add `api-staging.fugluck.com`.
3. Render and Vercel will automatically provision free SSL/TLS certificates for both subdomains.
4. Verify that `https://api-staging.fugluck.com/health` returns `{ "ok": true, "status": "healthy" }`.

---

## Environment Variable Reference Table

| Variable | Scope | Required in Staging? | Default / Example | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | Server | **Yes** | `postgresql://...` | Staging PostgreSQL connection URI |
| `JWT_SECRET` | Server | **Yes** | *64+ char random string* | Key for signing HTTP-only session cookies |
| `PORT` | Server | Auto-injected | `4000` / `10000` | Port on which the HTTP server listens |
| `NODE_ENV` | Server | **Yes** | `production` | Sets server runtime mode and security defaults |
| `CLIENT_ORIGIN` | Server | **Yes** | `https://staging.fugluck.com` | CORS origin allowed for credentialed cookies |
| `ALLOWED_ORIGINS` | Server | **Yes** | `https://staging.fugluck.com` | Comma-separated allowlist for CORS & WebSockets |
| `APP_URL` | Server | **Yes** | `https://staging.fugluck.com` | Base URL used in verification emails & reset links |
| `COOKIE_DOMAIN` | Server | **Yes** | `.fugluck.com` | Domain for cookie scoping across subdomains |
| `COOKIE_SAMESITE` | Server | Optional | `lax` | SameSite cookie attribute (`lax` / `none`) |
| `TRUST_PROXY` | Server | Optional | `1` | Reverse proxy hop count for secure headers & IP |
| `ENABLE_DEV_DIAMOND_STUB` | Server | Optional | `false` | Disables test diamond generation button |
| `EMAIL_PROVIDER` | Server | Optional | `logger` | Transactional email provider (`logger`, `resend`, `smtp`) |
| `EMAIL_FROM` | Server | Optional | `Fugluck <no-reply@fugluck.com>` | From email address header |
| `VITE_API_URL` | Client | **Yes** | `https://api-staging.fugluck.com` | Public API & WebSocket endpoint for frontend |

---

## Staging Verification & Smoke-Test Checklist

After completing the deployment steps above, conduct the following live browser verification:

### 1. Home & Navigation
- [ ] Open `https://staging.fugluck.com` in Chrome, Safari, and Firefox.
- [ ] Verify that styles, typography, SVG assets, and game canvas components render cleanly.
- [ ] Open Browser DevTools (F12) -> Console: confirm zero unhandled errors or missing assets.

### 2. Direct SPA Page Routing (Deep Links)
- [ ] Navigate directly to `https://staging.fugluck.com/terms` and refresh (F5) — page loads with full text.
- [ ] Navigate directly to `https://staging.fugluck.com/privacy` and refresh (F5).
- [ ] Navigate directly to `https://staging.fugluck.com/help` — search and category accordions work.
- [ ] Navigate to an invalid URL (`/unknown-page`) — renders the custom 404 page with Home button.

### 3. User Registration & Consent
- [ ] Click **Sign Up**.
- [ ] Verify that Terms & Privacy checkboxes are required before submitting registration.
- [ ] Register a new test user (`staging_user_1`).
- [ ] Confirm 1,000 Signup COINS are granted to the user balance.
- [ ] Log out, then log back in with credentials. Confirm session cookie is preserved on F5 refresh.

### 4. Game Catalog & Practice Play
- [ ] Select **Neon Runner** -> Practice Mode: canvas physics loop runs at 60 FPS without stutter.
- [ ] Select **Pixel Ninja Dash** -> Practice Mode: jump/dash reflex input triggers cleanly.
- [ ] Select **Space Blaster** -> Practice Mode: vector player ship and thruster animations render.
- [ ] Select **Cyber Hopper** -> Practice Mode: grid hopping navigation operates cleanly.
- [ ] Select **True / False Sprint** -> Practice Mode: answer options and timer function.
- [ ] Select **Speed Trivia Clash** -> Practice Mode: questions and score progression display.

### 5. Multiplayer Matchmaking & WebSockets
- [ ] Open a second private browser window and log in as `staging_user_2`.
- [ ] On User 1, click **Find Opponent** (COINS mode).
- [ ] Confirm User 1 appears in the live matchmaking queue on the home dashboard.
- [ ] On User 2, click **Match** to pair.
- [ ] Verify both players transition cleanly into the match room with shared seed.
- [ ] Complete the match rounds and verify winner resolution, score submission, and payout.

### 6. Wallet & Financial Safety
- [ ] Open `https://staging.fugluck.com/wallet`.
- [ ] Verify COINS balance reflects game outcomes and grants.
- [ ] Verify the Diamond Shop displays the **Development Sandbox** warning notice.
- [ ] Confirm that clicking diamond pack grants returns disabled error if `ENABLE_DEV_DIAMOND_STUB=false`.
- [ ] Verify there are NO fields requesting real credit cards, bank accounts, or withdrawal methods.

### 7. Security & Cookie Headers
- [ ] In DevTools -> Application -> Cookies:
  - `ac_session` cookie has `HttpOnly: true`.
  - `ac_session` cookie has `Secure: true`.
  - `ac_session` cookie domain is `.fugluck.com` or `api-staging.fugluck.com`.
  - `SameSite` is `Lax`.
- [ ] Network tab: Verify backend responds with `Access-Control-Allow-Origin: https://staging.fugluck.com`.

---

## Troubleshooting & Maintenance

* **CORS Error in Browser Console**:
  Confirm that `CLIENT_ORIGIN` and `ALLOWED_ORIGINS` in Render match `https://staging.fugluck.com` exactly (no trailing slashes).
* **Socket.IO Fails to Connect**:
  Verify `VITE_API_URL` in Vercel is set to `https://api-staging.fugluck.com` and that Render has completed its deployment.
* **Database Connection Failure**:
  Ensure `DATABASE_URL` includes `?sslmode=require` if required by your cloud PostgreSQL provider.
* **Restarting Backend**:
  In Render, click **Manual Deploy** -> **Deploy latest commit** or **Restart service**.
