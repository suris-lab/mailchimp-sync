# Workflow: Environment Setup

**Run this once before the first sync.**

---

## Step 1 — Google Cloud Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Sheets API**: APIs & Services → Library → search "Sheets API" → Enable
4. Create a Service Account: IAM & Admin → Service Accounts → Create
   - Name: `mailchimp-sync`
   - Skip role assignment (not needed for Sheets)
5. Open the service account → Keys tab → Add Key → JSON → Download
6. From the downloaded JSON, copy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (keep the `\n` line breaks)
7. Share your Google Sheet with the service account email (Viewer permission is enough)

---

## Step 2 — Google Sheet Setup

1. Open your Google Sheet
2. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**<SHEET_ID>**/edit`
3. Note the tab name that contains your contacts (e.g., `Sheet1`, `Members`)
4. Set env vars:
   - `SHEET_ID` = the ID from step 2
   - `SHEET_RANGE` = `<TabName>!A:Z` (e.g., `Members!A:Z`)
5. Verify row 1 contains these headers exactly:
   `MemberID`, `FullName`, `Membership`, `Membership_Modifier`, `Email1`,
   `Interest`, `Facility`, `Skill`, `Administrative`,
   `CreatedAt`, `UpdatedAt`, `ChangedId`, `Note`, `Phone`

---

## Step 3 — Mailchimp API Key & Audience

1. Mailchimp → Account menu → Extras → API Keys → Create A Key
2. Copy the key — set as `MAILCHIMP_API_KEY` (format: `key-us21`)
3. The `us21` suffix is your server prefix — set as `MAILCHIMP_SERVER_PREFIX`
4. Find your Audience ID: Audience → All Contacts → Settings → Audience name and defaults
   - Copy the Audience ID → set as `MAILCHIMP_AUDIENCE_ID`

---

## Step 4 — Map Existing Mailchimp Merge Tags

Your Mailchimp audience has existing merge fields for FullName, Membership, and Membership_Modifier.
You need to find their exact merge tag names.

1. Mailchimp → Audience → Settings → **Audience fields and *MERGE TAGS***
2. Find the rows for FullName, Membership, Membership_Modifier
3. Note the merge tag in the `*|TAG|*` column (e.g., `FULLNAME`, `MEMBER`, `MEMMOD`)
4. Set env vars:
   - `MC_TAG_FULLNAME` = your FullName merge tag
   - `MC_TAG_MEMBERSHIP` = your Membership merge tag
   - `MC_TAG_MEMBERSHIP_MOD` = your Membership_Modifier merge tag

---

## Step 5 — Create Custom Merge Fields in Mailchimp

These fields don't exist yet and must be created once:

1. Mailchimp → Audience → Settings → Audience fields and *MERGE TAGS* → Add A Field
2. Create each of the following as **Text** fields:

   | Label | Merge Tag |
   |---|---|
   | Member ID | `MEMBERID` |
   | Note | `NOTE` |
   | Created At | `CREATEDAT` |
   | Updated At | `UPDATEDAT` |
   | Changed ID | `CHANGEDID` |

   (Phone `PHONE` is a built-in Mailchimp field — no action needed)

---

## Step 6 — Vercel KV Database

1. Vercel Dashboard → Storage tab → Create Database → KV (Redis)
2. Name it `mailchimp-sync-kv`
3. After creation, click `.env.local` tab → copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`

---

## Step 7 — Webhook Secret

Generate a secure random secret:
```bash
openssl rand -hex 32
```
Set this as `WEBHOOK_SECRET`. You'll use the same value in the Apps Script.

---

## Step 8 — Deploy to Vercel

1. Push this repo to GitHub
2. Vercel Dashboard → Add New → Project → import the GitHub repo
3. Set all env vars from `.env.example` in Vercel → Settings → Environment Variables
4. Deploy — Vercel will auto-deploy on every `git push` to `main`
5. Note your deployment URL (e.g., `https://your-app.vercel.app`)

---

## Step 9 — Install Google Apps Script

1. Open the Google Sheet
2. Extensions → Apps Script
3. Paste the contents of `scripts/apps-script.gs`
4. Update `WEBHOOK_URL` to your Vercel deployment URL + `/api/webhook`
5. Update `WEBHOOK_SECRET` to match your `WEBHOOK_SECRET` env var
6. Save (Ctrl+S)
7. Add two triggers (clock icon → Add Trigger):
   - `onSheetEdit` → On edit
   - `onSheetEdit` → On change
8. Grant permissions when prompted (your Google account)
9. Test: edit a cell in the sheet → check Execution log in Apps Script for `200` response

---

## Step 10 — First Sync

1. Open your Vercel deployment URL (redirects to `/dashboard`)
2. Click **Sync Now**
3. Watch the KPI strip update — all contacts from the sheet will be added to Mailchimp
4. Verify in Mailchimp → Audience → All Contacts that contacts appeared with correct merge fields and tags
