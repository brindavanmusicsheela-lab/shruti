// ── Shruti – Google Apps Script Backend ───────────────────────────────────────
// Deploy as Web App: Execute as "Me", Who has access: "Anyone"
// After deploy, copy the Web App URL into app.js and dashboard.js

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const DRIVE_FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE'; // folder for recordings

// Sheet names (auto-created if missing)
const SHEET_SESSIONS = 'Sessions';
const SHEET_LESSONS  = 'Lessons';

// ── Router ────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.parameter.data || e.postData.contents);
    let result;
    if (payload.action === 'logSession') result = logSession(payload);
    else if (payload.action === 'logLesson')  result = logLesson(payload);
    else result = { error: 'Unknown action' };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getData') return jsonResponse(getData());
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── Log a practice session ────────────────────────────────────────────────────
function logSession(p) {
  const sheet = getOrCreateSheet(SHEET_SESSIONS, [
    'Date', 'Child', 'Category', 'Piece', 'Total Mins', 'Active Mins', 'Has Recording', 'Recording URL'
  ]);

  let recordingUrl = '';
  if (p.recording && p.hasRecording) {
    recordingUrl = saveRecordingToDrive(p.child, p.piece, p.date, p.recording, p.recordingMime);
  }

  sheet.appendRow([
    new Date(p.date),
    p.child,
    p.category,
    p.piece,
    p.totalMins || 0,
    p.activeMins || 0,
    p.hasRecording ? 'Yes' : 'No',
    recordingUrl
  ]);

  return { ok: true, recordingUrl };
}

// ── Log a lesson (teacher uploads) ───────────────────────────────────────────
// Teacher can call this via a separate simple form or the app
function logLesson(p) {
  const sheet = getOrCreateSheet(SHEET_LESSONS, [
    'Date', 'Child', 'Category', 'Piece', 'Notes', 'File URL'
  ]);

  sheet.appendRow([
    new Date(p.date),
    p.child,
    p.category,
    p.piece,
    p.notes || '',
    p.fileUrl || ''
  ]);

  return { ok: true };
}

// ── Read all data ─────────────────────────────────────────────────────────────
function getData() {
  return {
    sessions: readSheet(SHEET_SESSIONS),
    lessons:  readSheet(SHEET_LESSONS),
  };
}

// ── Drive: save recording ─────────────────────────────────────────────────────
function saveRecordingToDrive(child, piece, dateStr, dataUrl, mime) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

    // Find or create child subfolder
    let childFolder;
    const existing = folder.getFoldersByName(child);
    childFolder = existing.hasNext() ? existing.next() : folder.createFolder(child);

    // Decode base64
    const base64 = dataUrl.split(',')[1];
    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, mime || 'audio/webm');

    const datePart = new Date(dateStr).toISOString().slice(0, 10);
    const safePiece = piece.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40);
    const ext = mime && mime.includes('mp4') ? 'mp4' : 'webm';
    blob.setName(`${datePart}_${child.replace(' ', '')}_${safePiece}.${ext}`);

    const file = childFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (e) {
    Logger.log('Drive upload failed: ' + e.message);
    return '';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const key = h.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '');
      let val = row[i];
      if (val instanceof Date) val = val.toISOString();
      obj[key] = val;
    });
    // Normalize keys for frontend
    obj.child        = obj.child;
    obj.category     = obj.category;
    obj.piece        = obj.piece;
    obj.date         = obj.date;
    obj.totalMins    = Number(obj.total_mins) || 0;
    obj.activeMins   = Number(obj.active_mins) || 0;
    obj.hasRecording = obj.has_recording === 'Yes';
    obj.recordingUrl = obj.recording_url || obj.file_url || '';
    obj.notes        = obj.notes || '';
    obj.fileUrl      = obj.file_url || '';
    return obj;
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doOptions(e) {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}
