# InfluencerOS — Setup & Deployment Guide

InfluencerOS is a **Partner & Influencer Management Platform** powered by DoxTox,
living in the same repository as EMS but as a **completely separate application
with its own Supabase database** and its own API.

```
https://your-domain/                    → DoxTox landing page (index.html)
https://your-domain/ems.html            → EMS V1 (multi-shop management)
https://your-domain/influenceros/       → InfluencerOS  ← NEW
https://your-domain/api/ios/*           → InfluencerOS API (own database)
https://your-domain/api/*               → EMS API (EMS database)
```

Repository layout:

```
influenceros/
  index.html                        SPA shell (landing + login + admin + partner portal)
  assets/app.css                    UI (same design language as the reference HTML)
  assets/app.js                     Application logic
  supabase/migrations/
    001_influenceros_schema.sql     Database schema (run in a NEW Supabase project)
functions/api/ios/[[path]].js       InfluencerOS API (Cloudflare Pages Function)
tests/ios-api.test.mjs              API integration tests (45 checks)
```

---

## Step 1 — Create a NEW Supabase database (do not reuse EMS)

1. Go to <https://supabase.com> → **New project**.
2. Name it e.g. `influenceros-prod`, choose a region and a strong DB password.
3. Wait for the project to finish provisioning.
4. Open **SQL Editor → New query**.
5. Paste the entire content of `influenceros/supabase/migrations/001_influenceros_schema.sql` and click **Run**.
   - This creates tables `admins`, `partners`, `projects`, `allocations`, `payments`
     plus all enums, and locks them to service-role access only.
6. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `IOS_SUPABASE_URL`
   - **service_role secret** → this is `IOS_SUPABASE_SERVICE_ROLE_KEY`

## Step 2 — Generate a session secret

```bash
openssl rand -base64 48
```

Keep the output — this is `IOS_SESSION_SECRET`.

## Step 3 — Local development

1. In the repo root, open `.dev.vars` (create it from `.dev.vars.example` if needed)
   and add the three InfluencerOS variables (keep the EMS ones as they are):

   ```
   IOS_SUPABASE_URL=https://xxxxxxxx.supabase.co
   IOS_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   IOS_SESSION_SECRET=<output of openssl rand>
   ```

2. Start the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open <http://localhost:8788/influenceros/>
   - DoxTox landing: `http://localhost:8788/`
   - EMS: `http://localhost:8788/ems.html`

## Step 4 — First login

1. On the InfluencerOS landing page click **Login**.
2. Choose **Admin login** — since no administrator exists yet, the modal
   switches to *Create administrator*: enter name, email and a password
   (min 6 characters). This option disappears after the first admin exists.
3. You land on the **Admin dashboard**.
4. Click **Load demo data** to seed 6 partners, 4 projects, 6 allocations and
   4 payments so every screen is demonstrable immediately.
   - Demo partners can log in with their **4-digit Partner ID** (shown in the
     Partners table) or email, password `demo123`.

## Step 5 — Deploy to Cloudflare Pages

If EMS is already deployed, just push — no new build settings are needed.
The only new requirement is the three environment variables:

1. Cloudflare Dashboard → **Workers & Pages** → your EMS Pages project →
   **Settings → Variables and Secrets** → *Add* three encrypted secrets:

   | Name | Value |
   | --- | --- |
   | `IOS_SUPABASE_URL` | InfluencerOS Supabase project URL |
   | `IOS_SUPABASE_SERVICE_ROLE_KEY` | InfluencerOS service_role key |
   | `IOS_SESSION_SECRET` | output of `openssl rand -base64 48` |

2. Push to GitHub (or click **Retry deploy**). Build command stays blank,
   output directory stays `.`.
3. Visit `https://<your-pages-domain>/influenceros/` and log in.
4. The DoxTox landing page's **InfluencerOS** product card links to
   `/influenceros/` automatically.

> The two apps never mix data: EMS reads `SUPABASE_URL`, InfluencerOS reads
> `IOS_SUPABASE_URL`. The API routes are separated by path
> (`/api/*` = EMS, `/api/ios/*` = InfluencerOS) and by separate session secrets.

## Step 6 — Daily usage

**Admin** (Dashboard / Partners / Projects / Allocations / Payments / Performance):

1. **Partners → + Add partner** — basic info, up to 5 social accounts, password
   (min 6), login access, status. Financial fields are read-only and computed.
   After saving, a modal shows the generated **4-digit Partner ID**.
2. **Projects → + Add project** — name, details, budget, note, status.
   Target/acquired/used-budget update automatically from allocations.
3. **Allocations → + Add allocation** — pick a project and a partner
   *(only partners with status Agree are listed)*, set assigned target,
   acquired users, commission and status.
4. **Payments → + Add payment** — pick a project, then only partners allocated
   to it appear; their **available balance** is shown read-only and the amount
   can never exceed it. Use **Mark paid** when the money is transferred —
   paid totals and balances update automatically.
5. **Performance** — achievement % (acquired ÷ assigned × 100) and rank for
   every partner.
6. **Settings** — reserved for future development.

**Partner / Agent** (login with Partner ID or email):

- **Profile** — view account info; change password via *Edit profile*.
- **Projects** — only the projects allocated to them, with target/progress.
- **Payments** — Total Earnings / Paid / Available Balance + own payout history.
- **Performance** — own achievement, rank and project-wise breakdown.
- **Logout** ends the session and protects the dashboard pages.

## Step 7 — Run the test suite

```bash
node tests/ios-api.test.mjs      # InfluencerOS API — 45 checks
node tests/salary-api.test.mjs   # EMS salary API — 24 checks
```

Both run the real Pages Function code against a mocked Supabase, so no
database or Cloudflare account is needed.

---

### Security model (same as EMS)

- Passwords are PBKDF2-hashed (100k iterations); sessions are HMAC-signed JWTs
  signed with `IOS_SESSION_SECRET`.
- The browser never sees any Supabase key — all database access happens inside
  the Pages Function using the service-role key.
- Partner sessions are re-validated on every request and blocked the moment
  `login_access` is turned off.
- Payment amounts are re-validated server-side against the available balance.
