// Run this once to see what's in the shared folder.
// Results appear in the Execution Log (View → Logs or Ctrl+Enter after running).
function scanSharedFolder() {
  const FOLDER_ID = '1wtjmCI8bkHBMWbGCTvBTt0XIrWAmF0k8';

  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    Logger.log('Folder name: ' + folder.getName());

    // List subfolders
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      const sub = subfolders.next();
      Logger.log('📁 Subfolder: ' + sub.getName());
      const files = sub.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        Logger.log('   🎵 ' + f.getName() + ' | ' + f.getMimeType() + ' | ' + f.getDateCreated());
      }
    }

    // List files directly in the root folder
    const rootFiles = folder.getFiles();
    let count = 0;
    while (rootFiles.hasNext()) {
      const f = rootFiles.next();
      Logger.log('🎵 ' + f.getName() + ' | ' + f.getMimeType() + ' | ' + f.getDateCreated());
      count++;
    }

    if (count === 0) Logger.log('No files directly in root folder.');
  } catch (e) {
    Logger.log('ERROR: ' + e.message);
    Logger.log('Make sure this folder is shared with the Google account running this script.');
  }
}
