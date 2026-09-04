# Mailchimp Sync Takeover Plan

## Objective

Operate the HHYC Google Sheets-to-Mailchimp CRM safely from this repository, with a verified deployment, documented ownership of credentials, and a reproducible recovery process.

## System map (audited 2026-09-04)

```text
Google Sheet --(installable Apps Script trigger)--> POST /api/webhook
                                                    |
Vercel dashboard --(manual POST /api/sync)----------+--> Google Sheets API
Vercel Cron --(GET /api/backup daily)----------------+    Mailchimp Marketing API
                                                         Upstash Redis (sync state/logs)
                                                         Supabase (daily backups)
Content Studio --------------------------------------> OpenAI API + Mailchimp draft campaigns
```

The source of truth is the configured Google Sheet. The sync adds new Mailchimp contacts, updates existing merge fields, and applies tags additively; it does not remove stale tags or force resubscription of existing contacts.

## Verified takeover status (2026-09-04)

| Item | Status |
|---|---|
| Local source | Cloned from `suris-lab/mailchimp-sync`, `main` at `1176dda` (30 June 2026). |
| GitHub controls | `suris-lab` has administrator access. `main` now requires a pull request with one approval, dismisses stale approvals, requires resolved conversations and linear history, and blocks force-pushes/deletion. Administrator bypass remains enabled for recovery. |
| Vercel project | This checkout is linked to `suris-lab/mailchimp-sync`. The production deployment was refreshed successfully on 4 September 2026 after the public app URL update. |
| Production variables | All required service variable names are configured. Vercel correctly prevents sensitive production values from being downloaded into this checkout, so integration credentials remain protected. |
| Service checks | Read-only production checks for Google Sheets, Upstash state, and Supabase backup status return HTTP 200. Mailchimp campaign-report retrieval did not respond within 60 seconds and needs a timeout/caching investigation before it is relied on operationally. OpenAI has not been called because generation is billable. |
| Local verification | Dependencies install successfully and production compilation/type checking completes. Static build completion requires a valid local Supabase credential, which cannot be pulled under the current Vercel sensitive-variable policy. |
| Deployment access | The direct Vercel URL redirects to Vercel authentication, indicating Deployment Protection is enabled. Confirm that this is intentional for the intended CRM users. |
| Production URL | `https://mc.xxiihk.com` is attached to the active production deployment, is configured as Production `NEXT_PUBLIC_APP_URL`, and returns HTTP 200 at `/dashboard`. `mailchimpsync.xxiihk.com` is an obsolete, misconfigured alias; retire it only after confirming it has no remaining users or integrations. |

## Phase 1 — Establish ownership and safe local access

1. Confirm the GitHub repository owner/team and retain `main` as the production branch. Enable branch protection and require a deployment check before production changes.
2. Sign in to Vercel and link this checkout to the existing production project. Do not create a duplicate project until the existing deployment and environment variables have been identified.
3. Create a local `.env.local` only through `vercel env pull` after the project link is confirmed. It must remain untracked.
4. Assign at least two administrators for the GitHub repository, Vercel project, Google Cloud project, Mailchimp account, Upstash database, Supabase project, and OpenAI organization.

## Phase 2 — Reconcile credentials and integrations

Configure these secrets in Vercel for Production, Preview, and Development as appropriate; never put their values in Git.

| Integration | Required configuration |
|---|---|
| Google Cloud / Sheets | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `SHEET_ID`, `SHEET_RANGE`; enable Sheets API and Drive metadata API; share both the CRM Sheet and the hard-coded survey sheet with the service account. The service account needs editor access because imports can write to the CRM sheet. |
| Mailchimp | `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`, `MAILCHIMP_AUDIENCE_ID`, all `MC_TAG_*` mappings, `MAILCHIMP_FROM_NAME`, and `MAILCHIMP_REPLY_TO`. Verify every mapped merge tag exists and date fields have a Mailchimp Date type. |
| Vercel / Upstash | Prefer `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (legacy `KV_REST_*` names also work). Do not run production with the in-memory fallback. |
| Supabase | `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`; create and verify the three backup tables used by `/api/backup`: `sync_logs`, `daily_snapshots`, and `contact_snapshots`. |
| OpenAI | `OPENAI_API_KEY`, held server-side only; add a project-level spend limit/alerts. It powers campaign generation, not contact syncing. |
| Shared secrets | Generate independent, high-entropy `WEBHOOK_SECRET` and `CRON_SECRET`; set the webhook value in the deployed environment and the installed Google Apps Script trigger. |

Update `.env.example` in a later hardening change: it is missing several active `MC_TAG_*` variables and `NEXT_PUBLIC_APP_VERSION`.

## Phase 3 — Correct production controls before enabling full automation

1. Add application authentication and authorization to the dashboard and every state-changing route. At present, unauthenticated callers can trigger syncs, imports, schedules, OpenAI generation, and Mailchimp draft creation.
2. Add an explicit Vercel Cron entry for `GET /api/sync` at the agreed interval. The committed `vercel.json` only schedules daily `/api/backup`; the documented hourly reconciliation is therefore not currently configured.
3. Replace the webhook route's fire-and-forget background sync with a durable job or a platform-supported post-response task. A serverless invocation may end after returning the immediate `accepted` response.
4. Align the sync lock TTL with the 300-second route duration, or use an atomic Redis lock with safe renewal. Its current 120-second expiry can permit overlapping long syncs.
5. Decide and document the desired tag-removal policy. The current behavior is additive only.

## Phase 4 — Validate without changing production data

1. Install dependencies, run TypeScript/production build checks, and deploy a Preview environment with Preview-only credentials pointing to a test sheet and Mailchimp test audience.
2. Call the protected `/api/debug` endpoint and confirm Google Sheets, Mailchimp, and Redis checks all pass; confirm the backup tables through a manual protected backup run.
3. Verify the sheet headers. Required: `MemberID`, `FullName`, and `Email1`; the full expected contact schema is in `workflows/setup-environment.md`.
4. Verify Mailchimp merge fields and mappings, especially the optional birthday/training date fields. Confirm that one existing unsubscribed contact remains unsubscribed after update.
5. Test one new test contact, one changed contact, an Apps Script edit trigger, the manual dashboard sync, the scheduled sync, a backup run, and a Content Studio draft. Review outputs in Mailchimp and Supabase, then remove test contacts/campaign drafts as appropriate.

## Phase 5 — Cut over and operate

1. Take a snapshot of the production sheet and Mailchimp audience export before the first production run.
2. Deploy the reviewed build, set the Apps Script `WEBHOOK_URL` to `https://mc.xxiihk.com/api/webhook`, update its `WEBHOOK_SECRET`, and install the edit/change triggers under an owned Google account.
3. Run the first production sync manually and reconcile total processed, errors, new contacts, merge fields, tags, and unsubscribe status before enabling the recurring cron.
4. Review the dashboard and daily backup each business day for the first week; then weekly. Rotate API keys and shared secrets on staff changes or suspected exposure.
5. Keep this repository, `.env.example`, the Google Apps Script, merge-tag map, and the operations runbook synchronized whenever the CRM schema changes.

## Current blockers to live integration validation

The Vercel CLI is authenticated as `suris-lab` and this checkout is linked to the production project. However, the organization's sensitive-variable policy prevents the Google, Mailchimp, Upstash, Supabase, OpenAI, and shared-secret values from being downloaded locally. This is expected and should not be bypassed casually. A complete live diagnostic requires either an approved, controlled local secret-access process or an authenticated operator to run the protected checks from Vercel. Do not run a production sync until Phase 3 and Phase 4 are complete.
