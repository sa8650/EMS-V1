# EMS V1 deployment checklist

## 1. Prerequisites
- A Cloudflare account with Pages/Workers enabled.
- A Supabase project in an appropriate region.
- Node.js 20 or later and Git.
- A bKash/Nagad merchant reconciliation process for manual payment verification.

## 2. Provision PostgreSQL
1. Open **Supabase → SQL Editor → New query**.
2. Paste and run `supabase/migrations/001_ems_schema.sql`.
3. Paste and run `supabase/migrations/002_invoice_rpc.sql`.
4. Paste and run `supabase/migrations/003_platform_owner.sql`.
5. Paste and run `supabase/migrations/004_license_plans_and_capacity.sql`.
6. Paste and run `supabase/migrations/005_shop_id.sql`.
7. Paste and run `supabase/migrations/006_license_plan_flexible_values.sql`.
8. Paste and run `supabase/migrations/007_free_license_payment_method.sql`.
9. Paste and run `supabase/migrations/008_administrator_id.sql`.
10. Paste and run `supabase/migrations/009_business_short_ids.sql`.
11. Confirm there are no tables exposed to `anon` or `authenticated`; the first migration revokes these grants and enables RLS.
12. In **Project Settings → API**, copy the project URL and the **service_role** key. Never use the anon key for this app's private API and never paste service_role into frontend files.

## 3. Run safely on a developer computer
```bash
cd EMS
npm install
cp .dev.vars.example .dev.vars
# edit .dev.vars with real values; make the session secret:
openssl rand -base64 48
npm run dev
```
Open the local Pages URL shown by Wrangler. Create the first administrator. There is deliberately no seeded administrator or default password.

## 4. Deploy Cloudflare Pages
1. Push `EMS/` to a private Git repository.
2. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → connect the repository.
3. Set root directory to `EMS` if the repository's root contains other files.
4. Set build command to blank; output directory is `.`. The application is static Pages content plus the `functions/` directory.
5. In Pages **Settings → Variables and Secrets**, add encrypted secrets for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SESSION_SECRET`.
6. Deploy, then attach a custom domain and force HTTPS.
7. Visit the public site → **EMS login** → **Initialize first EMS owner**. This one-time secure bootstrap is available only before an owner exists.
8. Test: administrator registration/login, store creation, staff login, one purchase invoice, and one sale invoice.

## 5. Operational controls
- Manual license claims remain `pending`; activate only after transaction reconciliation. Do not treat a submitted trx ID as payment proof.
- Give each shop staff member a unique user ID; deactivate departing users rather than sharing credentials.
- Review `activity_logs` and `error_logs`, set a retention policy, and back up PostgreSQL.
- Rotate `SESSION_SECRET` only during a planned forced sign-out. Rotate Supabase service-role key immediately if it is exposed.
- Set Cloudflare account MFA and least-privilege access for the deployment project.

## 6. Security boundary
Browser → Cloudflare Pages Function (`/api/*`) → Supabase REST API. The function owns password hashing, signed sessions, role/tenant checks, logs, and the service key. Direct browser-to-Supabase writes are not part of this architecture.
