// Run once after importLessons to fix miscategorized entries.
function fixImport() {
  const ss    = SpreadsheetApp.openById('1kn_bpvosnpitG4ur45WDSJO34Rp3NItSj4AbzG-xXsk');
  const sheet = ss.getSheetByName('Lessons');
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];

  const col = name => headers.findIndex(h => h === name);
  const C = col('Child'), CAT = col('Category'), PIECE = col('Piece'),
        DATE = col('Date'), NOTES = col('Notes'), URL = col('File URL');

  let rowsToDelete = [];
  let rowsToAdd    = [];

  for (let i = 1; i < data.length; i++) {
    const row   = data[i];
    const piece = (row[PIECE] || '').toLowerCase().replace(/\s/g, '');
    const child = row[C];

    // Fix 1: Lakshanageetha → Geetham, both kids
    if (piece.includes('lakshanageetha') || piece.includes('lakshanageetham')) {
      if (child === 'Srai 1') {
        // Fix category
        sheet.getRange(i + 1, CAT + 1).setValue('Geetham');
        sheet.getRange(i + 1, PIECE + 1).setValue('Lakshana Geetham');
        Logger.log('Fixed: Lakshana Geetham → category Geetham');
        // Add Srai 2 row
        rowsToAdd.push([row[DATE], 'Srai 2', 'Geetham', 'Lakshana Geetham', row[NOTES], row[URL]]);
      }
    }

    // Fix 2: Hamsadhwani Varnamanu Pallavi → delete (part of Hamsadhwani Varnam)
    if (piece.includes('varnamanu') || piece.includes('varnamanupallavi')) {
      rowsToDelete.push(i + 1); // 1-indexed sheet row
      Logger.log('Marked for deletion: ' + row[PIECE]);
    }

    // Fix 3: Varalee Lagana Lola → Misc, both kids
    if (piece.includes('varalee') || piece.includes('varaleelaga')) {
      sheet.getRange(i + 1, CAT + 1).setValue('Misc');
      Logger.log('Fixed: Varalee Lagana Lola → category Misc');
      if (child === 'Srai 1') {
        rowsToAdd.push([row[DATE], 'Srai 2', 'Misc', 'Varalee Lagana Lola', row[NOTES], row[URL]]);
      }
    }
  }

  // Delete rows in reverse order so indices stay valid
  rowsToDelete.reverse().forEach(r => {
    sheet.deleteRow(r);
    Logger.log('Deleted row ' + r);
  });

  // Append new rows
  rowsToAdd.forEach(r => {
    sheet.appendRow(r);
    Logger.log('Added: ' + r[1] + ' | ' + r[2] + ' | ' + r[3]);
  });

  Logger.log('\nDone. ' + rowsToDelete.length + ' deleted, ' + rowsToAdd.length + ' added.');
}
