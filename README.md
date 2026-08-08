# EMS V1 — powered by DoxTox

Multi-shop management system for Cloudflare Pages Functions and Supabase PostgreSQL.

## Important security model
Passwords and sessions are handled only by `/functions/api/[[path]].js`. The browser never receives the Supabase service role key. Do **not** put any secret in `assets/js/config.js` or a Cloudflare `PUBLIC_*` variable. Custom auth tables are used; Supabase Auth is not required.

## Local start
1. Install Node 20+ and `npm install`.
2. Create a Supabase project. In SQL Editor run `supabase/migrations/001_ems_schema.sql`, `supabase/migrations/002_invoice_rpc.sql`, `supabase/migrations/003_platform_owner.sql`, `supabase/migrations/004_license_plans_and_capacity.sql`, `supabase/migrations/005_shop_id.sql`, `supabase/migrations/006_license_plan_flexible_values.sql`, `supabase/migrations/007_free_license_payment_method.sql`, `supabase/migrations/008_administrator_id.sql`, `supabase/migrations/009_business_short_ids.sql`, then `supabase/migrations/010_invoice_number_preview.sql`, `supabase/migrations/011_safe_invoice_delete.sql`, `supabase/migrations/012_due_recovery.sql`, `supabase/migrations/013_invoice_verification_qr.sql`, `supabase/migrations/014_custom_invoice_party.sql`, then `supabase/migrations/015_connectx_v1.sql` (in that exact order).
3. Copy `.dev.vars.example` to `.dev.vars`, insert the three real secrets, and generate `SESSION_SECRET` with `openssl rand -base64 48`.
4. Run `npm run dev`. Register the first administrator at `/`.

## Deploy to Cloudflare Pages
1. Create a Git repository, commit this project, and push it to GitHub/GitLab.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → connect the repository.
3. Build command: leave blank. Build output directory: `.`. Root directory: `EMS` if repository contains this folder.
4. Settings → Variables and Secrets → add encrypted secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`.
5. Deploy. Add your production custom domain in Pages → Custom domains.
6. In Supabase Settings → API, keep the service-role key private. It is server-only.

## Operating sequence
1. Register an administrator, then sign in.
2. Create a store; it begins inactive until a license is approved.
3. Submit a bKash/Nagad license request with the sender number and transaction ID.
4. An administrator records approval using the license update API (a platform/super-admin interface can be added separately).
5. Create staff in the Shop → Staff Manager page. Staff sign in with Store ID, User ID and password.

## Payments
The requested manual flow only records payment claims. It does not prove that bKash/Nagad payment occurred. Before activating any license, staff must verify the transaction in the official merchant portal.

## Backups and operations
Schedule Supabase backups/PITR on a suitable plan. Restrict Supabase project access, rotate service keys if exposed, and set Cloudflare access/2FA for administrators. No personally identifiable data is included as seed data.

## Staff access control
In **Shop Dashboard → Staff Manager**, create or edit a staff member, mark the account Active, and choose permissions per module: Dashboard, Supplier, Customer, Inventory, Purchase, Sales, Expense, Due Recover, Staff Manager, Report, and Settings. Each module has independent View, Add, Edit, and Delete toggles. Permission checks are performed by the server API; hiding a button alone is never treated as authorization.
