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
    002_contribute_changelog.sql    Contribute tables (run after 001)
    003_files_vaultium_helpdesk.sql  Multi-file proofs (Vaultium), C-codes, HelpDesk chat
    004_payment_methods.sql          Agent withdrawal/payment methods (profile)
    005_withdrawals.sql               Agent withdrawal requests & admin approval
functions/api/ios/[[path]].js       InfluencerOS API (Cloudflare Pages Function)
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
6. **Run migrations 002 and 003 too:** paste and run
   `influenceros/supabase/migrations/002_contribute_changelog.sql` then
   `influenceros/supabase/migrations/003_files_vaultium_helpdesk.sql`, then
   `004_payment_methods.sql`, then `005_withdrawals.sql`
   (multi-file proofs in Vaultium, C-codes, HelpDesk chat, payment methods,
   withdrawal requests).
7. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `IOS_SUPABASE_URL`
   - **service_role secret** → this is `IOS_SUPABASE_SERVICE_ROLE_KEY`

## Step 1b — File storage (Vaultium)

Contribution proof files are managed by **Vaultium** — the same R2 bucket as
EMS (`emsvaultium`, binding `VAULTIUM` in `wrangler.toml`), namespaced under
the `ios/` prefix. If your Pages project already uses Vaultium for EMS,
there is **nothing new to set up**. Otherwise create the bucket and bind it:
**Workers & Pages → your project → Settings → Functions → R2 bucket bindings**
→ Variable `VAULTIUM`, bucket `emsvaultium`, then redeploy.

Files open through a token-authenticated API route (`/api/ios/files/:id`), so
proofs are never public. Agents can attach up to 10 files per request
(each ≤ 10 MB).

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
3. **Allocations → + Add allocation** — pick a project and an agent
   *(only agents with status Agree are listed)* and set assigned target,
   status and note. **Acquired users fill automatically from accepted
   contributions and commission fills automatically from payments** — neither
   is entered manually anymore.
4. **Payments** — two tables side by side. Left: **Payouts** (+ Add payment
   opens the agent-picker modal: profile, project cards, payment history and
   a New payment card). Commission is added **only when a payment is Paid**
   (scheduled/pending add nothing; Mark paid adds it; deleting a paid payment
   removes it). Right: **Withdraw requests** — every agent withdrawal with
   method/type/number/address, amount, provider number, trx and status.
   **Accept** asks for the Provider number + Transaction ID; **Reject** asks
   for a reason. Columns: Payouts — Payment ID · Date · Agent · Project ·
   Amount · Status; Withdrawals — ID · Date · Agent · Method · Type · Number/
   Address · Amount · Provider · Trx · Status.
5. **Performance** — achievement % and rank (unchanged).
   Agent side: the Payments page has a **Withdraw** button (available balance,
   select a saved payment method, amount). Requests lock the balance while
   pending; the agent's *Paid* KPI shows successfully withdrawn amounts, and
   their withdrawal table never shows the provider number.
6. **Contribute** — all agent contribution requests with their **C-codes**
   (C12345), date & time, agent, project, acquired users, multi-file proof
   viewer, note, status and review note. **Accept** adds the requested users
   to the allocation's *Users acquired* automatically; **Reject** stores the
   optional reason. Every accepted/rejected row stays in both panels.
7. **Vaultium** — every proof file with name, date & time, size, type,
   contribution C-code, agent and project; open or delete files.
8. **HelpDesk** — one continuous conversation per agent (chat bubbles,
   unread badges, 12s auto-refresh). Reply from the thread modal.
9. **Settings** — reserved for future development.

**Partner / Agent** (login with Partner ID or email):

- **Contribute** — submit acquired users for an allocated project with up to
  10 proof files (each ≤ 10 MB, stored in the Vaultium bucket). Each request
  gets a C-code (C12345) and shows status + admin review note forever.
- **HelpDesk** — one continuous chat with the administrator (unread badge,
  auto-refresh).
- **Profile** — view account info (agent status hidden). *Payment method*
  lets you save up to 5 withdrawal methods — bKash/Nagad (number + Agent/
  Personal) or Crypto USDT TRC20 wallet — each editable/deletable in the
  Payment methods table. *Edit profile* lets
  the partner change Name, Email, Phone number, Social accounts (up to 5 URLs)
  and Password (blank = keep current). Every change is written to an admin-only
  audit log, visible in Admin → Partners → **View** (full profile + edit
  history table).
- **Projects** — only the projects allocated to them, with target/progress.
- **Payments** — Total Earnings / Paid / Available Balance KPIs (unchanged)
  + own payout history (Payment ID · Date · Project · Amount · Status).
- **Performance** — own achievement, rank and project-wise breakdown.
- **Logout** ends the session and protects the dashboard pages.

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
