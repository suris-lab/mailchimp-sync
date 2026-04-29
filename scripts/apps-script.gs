// ============================================================
// Google Sheets → Mailchimp Sync Trigger
//
// SETUP:
// 1. Open your Google Sheet
// 2. Extensions > Apps Script > paste this entire file > Save (Ctrl+S)
// 3. Update WEBHOOK_URL and WEBHOOK_SECRET below
// 4. Click the clock icon (Triggers) > Add Trigger
//    - Function: onSheetEdit
//    - Event source: From spreadsheet
//    - Event type: On edit
//    - Click Save and grant permissions
// 5. Add a second trigger with event type: On change
//    (catches bulk pastes and imports)
// ============================================================

var WEBHOOK_URL = 'https://your-app.vercel.app/api/webhook';
var WEBHOOK_SECRET = 'your-webhook-secret-here'; // must match WEBHOOK_SECRET env var

function onSheetEdit(e) {
  var lock = LockService.getScriptLock();
  // Debounce: if another trigger fired in the last 10s, skip
  if (!lock.tryLock(0)) {
    Logger.log('Skipped: lock held by concurrent trigger');
    return;
  }

  try {
    var sheet = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();

    var payload = JSON.stringify({
      sheetId: sheet.getId(),
      sheetName: sheet.getName(),
      triggeredAt: new Date().toISOString(),
      editedRange: (e && e.range) ? e.range.getA1Notation() : null
    });

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET
      },
      payload: payload,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Sync response: ' + response.getResponseCode() + ' ' + response.getContentText());
  } catch (err) {
    Logger.log('Sync error: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}

// Adds a "Sync" menu to the sheet for manual on-demand syncs
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Mailchimp Sync')
    .addItem('Sync Now', 'onSheetEdit')
    .addToUi();
}
