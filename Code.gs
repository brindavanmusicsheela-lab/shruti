// ── Shruti – Google Apps Script Backend ───────────────────────────────────────
const SPREADSHEET_ID = '1kn_bpvosnpitG4ur45WDSJO34Rp3NItSj4AbzG-xXsk';
const DRIVE_FOLDER_ID = '1wtjmCI8bkHBMWbGCTvBTt0XIrWAmF0k8';

const SHEET_SESSIONS   = 'Sessions';
const SHEET_LESSONS    = 'Lessons';
const SHEET_ASSIGNMENTS = 'Assignments';

const PRACTICE_CATEGORIES = [
  'Sarali Varisai', 'Janta Varisai', 'Tara Sthayi Varisai',
  'Alankarams', 'Geetham', 'Swarajathi', 'Varnam', 'Misc'
];

// ── Router ────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.parameter.data || e.postData.contents);
    let result;
    if (payload.action === 'logSession')      result = logSession(payload);
    else if (payload.action === 'logLesson')   result = logLesson(payload);
    else if (payload.action === 'setAssignment') result = setAssignment(payload);
    else result = { error: 'Unknown action' };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getData')          return jsonResponse(getData());
    if (action === 'getAiSuggestions') return jsonResponse(getAiSuggestions(e.parameter.child));
    return jsonResponse({ error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── Log a practice session ────────────────────────────────────────────────────
function logSession(p) {
  const sheet = getOrCreateSheet(SHEET_SESSIONS, [
    'Date', 'Child', 'Category', 'Piece', 'Total Mins', 'Active Mins',
    'Has Recording', 'Recording URL', 'Is Assigned'
  ]);

  let recordingUrl = '';
  if (p.recording && p.hasRecording) {
    recordingUrl = saveRecordingToDrive(p.child, p.piece, p.date, p.recording, p.recordingMime);
  }

  sheet.appendRow([
    new Date(p.date), p.child, p.category, p.piece,
    p.totalMins || 0, p.activeMins || 0,
    p.hasRecording ? 'Yes' : 'No',
    recordingUrl,
    p.isAssigned ? 'Yes' : 'No'
  ]);

  return { ok: true, recordingUrl };
}

// ── Log a lesson ──────────────────────────────────────────────────────────────
function logLesson(p) {
  const sheet = getOrCreateSheet(SHEET_LESSONS, [
    'Date', 'Child', 'Category', 'Piece', 'Notes', 'File URL', 'Is Current'
  ]);
  sheet.appendRow([
    new Date(p.date), p.child, p.category, p.piece,
    p.notes || '', p.fileUrl || '', p.isCurrent ? 'Yes' : 'No'
  ]);
  return { ok: true };
}

// ── Save weekly assignment ────────────────────────────────────────────────────
function setAssignment(p) {
  const sheet = getOrCreateSheet(SHEET_ASSIGNMENTS, [
    'Week Start', 'Child', 'Category', 'Piece', 'Set By'
  ]);

  const weekStart = getWeekStart();

  // Remove existing assignments for this child this week
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const rowWeek = data[i][0] instanceof Date ? data[i][0].toISOString().slice(0, 10) : String(data[i][0]).slice(0, 10);
    if (rowWeek === weekStart && data[i][1] === p.child) {
      sheet.deleteRow(i + 1);
    }
  }

  // Insert new assignments
  p.assignments.forEach(a => {
    sheet.appendRow([weekStart, p.child, a.category, a.piece, p.setBy || 'teacher']);
  });

  return { ok: true };
}

// ── AI suggestions ────────────────────────────────────────────────────────────
function getAiSuggestions(child) {
  const sessions = readSheet(SHEET_SESSIONS).filter(s => s.child === child);
  const lessons  = readSheet(SHEET_LESSONS).filter(l => l.child === child);
  const now      = new Date();

  // Build piece inventory from lessons taught
  const pieceMap = {};
  lessons.forEach(l => {
    const key = l.category + '||' + l.piece;
    if (!pieceMap[key]) pieceMap[key] = { category: l.category, piece: l.piece, lastPracticed: null, totalActiveMins: 0 };
  });

  // Score by practice history
  sessions.forEach(s => {
    const key = s.category + '||' + s.piece;
    if (pieceMap[key]) {
      const d = new Date(s.date);
      if (!pieceMap[key].lastPracticed || d > new Date(pieceMap[key].lastPracticed)) {
        pieceMap[key].lastPracticed = s.date;
      }
      pieceMap[key].totalActiveMins += s.activeMins || 0;
    }
  });

  // Score: higher = more urgent to practice
  // Days since last practiced (never = 999) + penalty for low total mins
  const scored = Object.values(pieceMap).map(p => {
    const daysSince = p.lastPracticed
      ? Math.floor((now - new Date(p.lastPracticed)) / 86400000)
      : 999;
    const minPenalty = Math.max(0, 30 - p.totalActiveMins); // penalize if < 30 mins total
    return { ...p, score: daysSince + minPenalty };
  });

  // Pick top piece per category
  const suggestions = {};
  PRACTICE_CATEGORIES.forEach(cat => {
    const candidates = scored
      .filter(p => p.category === cat)
      .sort((a, b) => b.score - a.score);
    if (candidates.length) suggestions[cat] = candidates[0];
  });

  return { suggestions };
}

// ── Read all data ─────────────────────────────────────────────────────────────
function getData() {
  const sessions    = readSheet(SHEET_SESSIONS);
  const lessons     = readSheet(SHEET_LESSONS);
  const assignments = readAssignments();
  return { sessions, lessons, assignments };
}

function readAssignments() {
  const sheet = getOrCreateSheet(SHEET_ASSIGNMENTS, [
    'Week Start', 'Child', 'Category', 'Piece', 'Set By'
  ]);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const weekStart = getWeekStart();
  return data.slice(1)
    .filter(row => {
      const rowWeek = row[0] instanceof Date ? row[0].toISOString().slice(0, 10) : String(row[0]).slice(0, 10);
      return rowWeek === weekStart;
    })
    .map(row => ({
      weekStart: row[0] instanceof Date ? row[0].toISOString() : row[0],
      child: row[1], category: row[2], piece: row[3], setBy: row[4]
    }));
}

// ── Drive: save recording ─────────────────────────────────────────────────────
function saveRecordingToDrive(child, piece, dateStr, dataUrl, mime) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    let childFolder;
    const existing = folder.getFoldersByName(child);
    childFolder = existing.hasNext() ? existing.next() : folder.createFolder(child);

    const base64 = dataUrl.split(',')[1];
    const bytes  = Utilities.base64Decode(base64);
    const blob   = Utilities.newBlob(bytes, mime || 'audio/webm');

    const datePart  = new Date(dateStr).toISOString().slice(0, 10);
    const safePiece = piece.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 40);
    const ext       = mime && mime.includes('mp4') ? 'mp4' : 'webm';
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
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  return start.toISOString().slice(0, 10);
}

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
    obj.isCurrent    = obj.is_current === 'Yes';
    obj.isAssigned   = obj.is_assigned === 'Yes';
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
