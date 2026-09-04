// ============================================================
// Google Sheets → Mailchimp Sync Trigger
//
// SETUP:
// 1. Open your Google Sheet
// 2. Extensions > Apps Script > paste this entire file > Save (Ctrl+S)
// 3. Update WEBHOOK_URL to https://mc.xxiihk.com/api/webhook and set WEBHOOK_SECRET below
// 4. Click the clock icon (Triggers) > Add Trigger
//    - Function: onSheetEdit
//    - Event source: From spreadsheet
//    - Event type: On edit
//    - Click Save and grant permissions
// 5. Add a second trigger:
//    - Function: onSheetChange
//    - Event source: From spreadsheet
//    - Event type: On change
//    (catches bulk pastes and imports)
// 6. Add a time-driven trigger for hourlySync, every hour.
//    This is the reconciliation fallback because Vercel Hobby permits one cron
//    and that cron is reserved for the daily Supabase backup.
// ============================================================

var WEBHOOK_URL = 'https://your-app.vercel.app/api/webhook';
var WEBHOOK_SECRET = 'your-webhook-secret-here'; // must match WEBHOOK_SECRET env var

var HEADER = {
  MEMBER_ID: 'MemberID',
  EMAIL: 'Email1',
  MEMBERSHIP: 'Membership',
  MEMBERSHIP_MODIFIER: 'Membership_Modifier',
  CREATED_AT: 'CreatedAt',
  UPDATED_AT: 'UpdatedAt'
};

function timestampNow() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy HH:mm:ss');
}

function headerColumns(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var columns = {};
  headers.forEach(function(header, index) {
    columns[String(header).trim()] = index + 1;
  });
  return columns;
}

function isMember(membership) {
  var value = String(membership || '').trim().toLowerCase();
  return value.indexOf('member') !== -1 &&
    value.indexOf('non-member') === -1 &&
    value.indexOf('non_member') === -1 &&
    value.indexOf('backup') === -1;
}

function editIncludesColumn(range, column) {
  return column >= range.getColumn() && column < range.getColumn() + range.getNumColumns();
}

// Maintains the audit dates that power the dashboard's member trend:
// - a new member gets CreatedAt and UpdatedAt if they are blank;
// - changing Membership_Modifier to Member_Resigned records UpdatedAt.
// Dates are written only for rows touched by an actual edit, never by a scan
// of historical data, so existing records cannot be accidentally re-dated.
function stampMembershipTimeline(e) {
  if (!e || !e.range) return;

  var range = e.range;
  var sheet = range.getSheet();
  if (range.getRow() === 1) return;

  var columns = headerColumns(sheet);
  var required = [HEADER.MEMBER_ID, HEADER.EMAIL, HEADER.MEMBERSHIP, HEADER.MEMBERSHIP_MODIFIER, HEADER.CREATED_AT, HEADER.UPDATED_AT];
  if (!required.every(function(name) { return columns[name]; })) {
    Logger.log('Timeline stamps skipped: required headers are missing');
    return;
  }

  var membershipEdited = editIncludesColumn(range, columns[HEADER.MEMBERSHIP]);
  var memberIdEdited = editIncludesColumn(range, columns[HEADER.MEMBER_ID]);
  var emailEdited = editIncludesColumn(range, columns[HEADER.EMAIL]);
  var modifierEdited = editIncludesColumn(range, columns[HEADER.MEMBERSHIP_MODIFIER]);
  var rowCount = range.getNumRows();
  var firstRow = range.getRow();
  var width = sheet.getLastColumn();
  var rows = sheet.getRange(firstRow, 1, rowCount, width).getDisplayValues();
  var stamp = timestampNow();

  rows.forEach(function(row, offset) {
    var rowNumber = firstRow + offset;
    var membership = row[columns[HEADER.MEMBERSHIP] - 1];
    var memberId = row[columns[HEADER.MEMBER_ID] - 1];
    var email = row[columns[HEADER.EMAIL] - 1];
    var createdAt = row[columns[HEADER.CREATED_AT] - 1];
    var updatedAt = row[columns[HEADER.UPDATED_AT] - 1];
    var modifier = row[columns[HEADER.MEMBERSHIP_MODIFIER] - 1];
    var hasIdentity = String(memberId || '').trim() || String(email || '').trim();

    // A member is considered newly added only when the edit included an identity
    // or membership field and CreatedAt is still blank. This avoids altering old
    // rows merely because another field is edited later.
    var newMember = hasIdentity && isMember(membership) && !createdAt &&
      (membershipEdited || memberIdEdited || emailEdited);
    if (newMember) {
      sheet.getRange(rowNumber, columns[HEADER.CREATED_AT]).setValue(stamp);
      if (!updatedAt) sheet.getRange(rowNumber, columns[HEADER.UPDATED_AT]).setValue(stamp);
    }

    if (modifierEdited && String(modifier).trim() === 'Member_Resigned') {
      sheet.getRange(rowNumber, columns[HEADER.UPDATED_AT]).setValue(stamp);
    }
  });
}

function onSheetEdit(e) {
  var lock = LockService.getScriptLock();
  // Debounce: if another trigger fired in the last 10s, skip
  if (!lock.tryLock(0)) {
    Logger.log('Skipped: lock held by concurrent trigger');
    return;
  }

  try {
    stampMembershipTimeline(e);
    var sheet = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    triggerWebhook(sheet, e);
  } catch (err) {
    Logger.log('Sync error: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}

function triggerWebhook(sheet, e) {
  var payload = JSON.stringify({
    sheetId: sheet.getId(),
    sheetName: sheet.getName(),
    triggeredAt: new Date().toISOString(),
    editedRange: (e && e.range) ? e.range.getA1Notation() : null
  });
  var response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
    payload: payload,
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = response.getContentText();
  Logger.log('Sync response: ' + status + ' ' + body);
  if (status < 200 || status >= 300) {
    throw new Error('Webhook failed (' + status + '): ' + body);
  }
}

// Install this as the spreadsheet "On change" trigger. It does not alter
// timestamps because Apps Script change events have no edited cell range.
function onSheetChange(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return;
  try {
    triggerWebhook(SpreadsheetApp.getActiveSpreadsheet(), e);
  } finally {
    lock.releaseLock();
  }
}

// Install this as a time-driven Apps Script trigger, every hour.
function hourlySync() {
  triggerWebhook(SpreadsheetApp.getActiveSpreadsheet(), null);
}

// Adds a "Sync" menu to the sheet for manual on-demand syncs
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Mailchimp Sync')
    .addItem('Sync Now', 'onSheetEdit')
    .addToUi();
}
