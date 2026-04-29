# Workflow: Sync Google Sheet Contacts to Mailchimp

**Objective:** Read all rows from the configured Google Sheet and upsert them into the Mailchimp audience.

---

## Inputs Required

| Env Var | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Auth for Sheets API |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Auth for Sheets API |
| `SHEET_ID` | Which spreadsheet to read |
| `SHEET_RANGE` | Which tab and columns (e.g. `Members!A:Z`) |
| `MAILCHIMP_API_KEY` | Auth for Mailchimp |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp data center (e.g. `us21`) |
| `MAILCHIMP_AUDIENCE_ID` | Which audience to sync into |
| `MC_TAG_FULLNAME` | Existing merge tag for FullName |
| `MC_TAG_MEMBERSHIP` | Existing merge tag for Membership |
| `MC_TAG_MEMBERSHIP_MOD` | Existing merge tag for Membership_Modifier |

---

## Trigger Methods

1. **Sheet edit** — Google Apps Script fires on any cell edit → `POST /api/webhook` → sync runs within ~10s
2. **Hourly cron** — Vercel Cron calls `POST /api/sync` every hour as a reconciliation safety net
3. **Manual** — Click "Sync Now" button on the dashboard → `POST /api/sync`

---

## Tool Execution Sequence

```
tools/google-sheets.ts
  → Authenticates with Service Account
  → Fetches all rows from SHEET_ID / SHEET_RANGE
  → Parses headers from row 1
  → Skips rows with empty Email1
  → Returns SheetContact[]

tools/validate-sheet-schema.ts (called inside sync-engine)
  → Checks that Email1, FullName, MemberID headers exist
  → Throws if missing required columns

lib/kv.ts (read)
  → Loads known email set from KV key "sync:known_emails"
  → Used to diff new vs existing contacts

tools/mailchimp-upsert.ts
  → New contacts: batchListMembers (500/batch, status: subscribed)
  → Existing contacts: updateListMember (merge fields only)
  → All contacts: updateListMemberTags (Interest, Facility, Skill, Administrative)

lib/kv.ts (write)
  → Saves SyncLog to "sync:log:{id}"
  → Prepends id to "sync:log_ids" list
  → Updates "sync:stats" aggregate
  → Updates "sync:known_emails" with newly added emails
  → Clears "sync:lock"
```

---

## Field Mapping

### Merge Fields (scalar)
| Sheet Column | Mailchimp Merge Tag |
|---|---|
| Email1 | `email_address` (core) |
| FullName | `FNAME` + `LNAME` (split on first space) + `MC_TAG_FULLNAME` |
| Membership | `MC_TAG_MEMBERSHIP` |
| Membership_Modifier | `MC_TAG_MEMBERSHIP_MOD` |
| Phone | `PHONE` |
| MemberID | `MEMBERID` |
| Note | `NOTE` |
| CreatedAt | `CREATEDAT` |
| UpdatedAt | `UPDATEDAT` |
| ChangedId | `CHANGEDID` |

### Tags (multi-select → Mailchimp tags)
Each selected value in these columns becomes a Mailchimp tag:

| Sheet Column | Tag Format |
|---|---|
| Interest | `Interest: <value>` |
| Facility | `Facility: <value>` |
| Skill | `Skill: <value>` |
| Administrative | `Administrative: <value>` |

Tags are additive: existing tags are never removed automatically.
To remove stale tags, manually edit the contact in Mailchimp or run a cleanup via the API.

---

## Error Handling

| Failure | Behaviour |
|---|---|
| Missing env vars | `sync-engine` throws, log status = `error` |
| Sheet has no rows | Returns empty, 0 processed, status = `success` |
| Missing required headers | Throws with list of missing columns |
| Mailchimp batch error | Per-contact error captured, sync continues, status = `partial` |
| Mailchimp rate limit (429) | Surfaces as error — re-trigger via "Sync Now" or wait for hourly cron |
| KV unavailable | Falls back to in-memory store (data lost on function restart) |

**On rate limits:** Mailchimp allows 10 requests/second on Marketing API. For large sheets (5,000+ contacts), the sync may take 30–60 seconds. The Vercel function timeout is 60s — sufficient for most audiences. If you hit limits consistently, consider splitting into smaller ranges via `SHEET_RANGE`.

---

## Expected Outputs

- Contacts appear in Mailchimp audience with all merge fields populated
- Tags applied: `Interest: *`, `Facility: *`, `Skill: *`, `Administrative: *`
- Dashboard KPI strip updates (auto-refresh every 30s)
- Sync log entry visible in the history table

---

## Known Constraints

- Tag removal is not automatic — stale tags must be cleaned manually
- `FullName` split uses first word as first name; multi-word first names will be truncated
- Contacts with empty `Email1` cells are silently skipped
- Vercel Hobby plan: 1 cron job max (hourly). Upgrade to Pro for more frequent cron polling
- KV stores up to 200 most recent sync log IDs in the `sync:log_ids` list
