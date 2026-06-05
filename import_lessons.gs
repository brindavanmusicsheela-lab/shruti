// ── Import historical lesson recordings from shared Drive folder ───────────────
// Run once. Logs all files into the Lessons sheet in your Shruti spreadsheet.

const IMPORT_FOLDER_ID  = '1wtjmCI8bkHBMWbGCTvBTt0XIrWAmF0k8';
const IMPORT_SHEET_ID   = 'YOUR_SPREADSHEET_ID_HERE'; // same as in Code.gs

// Varnams Srai 2 has learned (lowercase, no spaces, no extension)
const SRAI2_VARNAMS = ['mohanavarnam'];

function importLessons() {
  const ss     = SpreadsheetApp.openById(IMPORT_SHEET_ID);
  let sheet    = ss.getSheetByName('Lessons');
  if (!sheet) {
    sheet = ss.insertSheet('Lessons');
    sheet.appendRow(['Date', 'Child', 'Category', 'Piece', 'Notes', 'File URL']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const rootFolder = DriveApp.getFolderById(IMPORT_FOLDER_ID);
  const folderLabel = rootFolder.getName(); // "Exam"
  let imported = 0;
  let skipped  = 0;

  const subfolders = rootFolder.getFolders();
  while (subfolders.hasNext()) {
    const sub      = subfolders.next();
    const category = cleanName(sub.getName()); // e.g. "Varnam"

    const files = sub.getFiles();
    const seen  = new Set(); // track duplicates within this subfolder

    while (files.hasNext()) {
      const file     = files.next();
      const rawName  = file.getName().replace(/\.[^.]+$/, ''); // strip extension
      const key      = rawName.toLowerCase().replace(/\s/g, '');

      if (seen.has(key)) {
        Logger.log('SKIP duplicate: ' + file.getName());
        skipped++;
        continue;
      }
      seen.add(key);

      const piece    = cleanName(rawName);
      const date     = file.getDateCreated();
      const fileUrl  = file.getUrl();
      const notes    = folderLabel === 'Exam' ? 'Exam recording by teacher' : 'Lesson recording by teacher';

      // Determine which children get this recording
      const children = childrenForPiece(category, key);

      children.forEach(child => {
        sheet.appendRow([date, child, category, piece, notes, fileUrl]);
        Logger.log(`✅ ${child} | ${category} | ${piece} | ${date.toDateString()}`);
        imported++;
      });
    }
  }

  Logger.log(`\nDone. ${imported} rows imported, ${skipped} duplicates skipped.`);
}

// ── Which children get this piece? ────────────────────────────────────────────
function childrenForPiece(category, keyName) {
  const cat = category.toLowerCase();

  // Sarali through Swarajathi → both kids
  const commonCategories = ['sarali', 'janta', 'tara', 'alankaram', 'geetham', 'swarajathi'];
  if (commonCategories.some(c => cat.includes(c))) {
    return ['Srai 1', 'Srai 2'];
  }

  // Varnam → Srai 1 always; Srai 2 only for known pieces
  if (cat.includes('varnam')) {
    const forSrai2 = SRAI2_VARNAMS.some(v => keyName.includes(v));
    return forSrai2 ? ['Srai 1', 'Srai 2'] : ['Srai 1'];
  }

  // Default: both kids
  return ['Srai 1', 'Srai 2'];
}

// ── Clean up filename → readable piece name ───────────────────────────────────
// "mohanavarnamcharanachitte" → "Mohana Varnam Charana Chitte"
function cleanName(raw) {
  // Split on known Carnatic keywords to add spaces
  const keywords = [
    'varnam','geetham','sahitya','charana','chitte','pallavi','anupallavi',
    'swarajathi','alankaram','sarali','janta','tara','mohana','kalyani',
    'hamsadhwani','niinu','kori','varalee','lagana','lola','abogiswara',
    'lakshana','bhairavi','shankarabharanam','kambhoji','thodi','begada',
  ];

  let name = raw.trim();

  // If already has spaces/caps (e.g. "Kalyanivarnam"), just capitalize words
  if (/[A-Z]/.test(name) && name.includes(' ')) {
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Insert spaces before each recognized keyword
  const lower = name.toLowerCase();
  let result = lower;
  keywords.forEach(kw => {
    result = result.replace(new RegExp('(?<=[a-z])(' + kw + ')', 'g'), ' $1');
  });

  // Capitalize each word
  return result.split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
