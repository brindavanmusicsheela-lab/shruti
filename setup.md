# Shruti – Setup Guide

## What you need
- A Google account (yours)
- 15 minutes

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet
2. Name it **Shruti Practice Log**
3. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**THIS_PART_HERE**`/edit`

---

## Step 2 — Create the Drive folder for recordings

1. Go to [drive.google.com](https://drive.google.com)
2. Create a new folder called **Shruti Recordings**
3. Open the folder and copy its ID from the URL:
   `https://drive.google.com/drive/folders/`**THIS_PART_HERE**

---

## Step 3 — Set up the Apps Script backend

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Name it **Shruti Backend**
3. Delete the default `myFunction()` code
4. Paste the entire contents of `Code.gs` from this folder
5. Replace the two placeholders at the top:
   ```js
   const SPREADSHEET_ID = 'paste your sheet ID here';
   const DRIVE_FOLDER_ID = 'paste your folder ID here';
   ```
6. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** → authorize when prompted
8. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/ABC.../exec`)

---

## Step 4 — Connect the app

Open both `app.js` and `dashboard.js` and replace:
```js
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```
with the URL you copied.

---

## Step 5 — Host the app (free options)

**Option A – GitHub Pages (recommended)**
1. Create a free GitHub account
2. Upload this folder to a new repository
3. Go to repo Settings → Pages → deploy from main branch
4. Your app is live at `https://yourusername.github.io/shruti`

**Option B – Netlify Drop**
1. Go to [netlify.com/drop](https://app.netlify.com/drop)
2. Drag this folder onto the page
3. Get a free URL instantly

---

## Step 6 — Tell the teacher

Share the dashboard URL with your teacher — no login needed.  
It's read-only: `https://your-app-url/dashboard.html`

---

## Teacher: uploading lesson recordings

After each class, the teacher uploads to Google Drive with this naming format:

```
YYYY-MM-DD_[ChildName]_[Category]_[PieceName].[ext]

Examples:
2026-06-05_Srai1_Geetham_MalahariGeetham.m4a
2026-06-05_Srai2_Alankarams_Alankaram1.m4a
```

Folder structure in Drive:
```
Shruti Recordings/
  Srai 1/
    practice recordings (auto-saved by app)
  Srai 2/
    practice recordings (auto-saved by app)
  Lessons/          ← teacher uploads here
    Srai 1/
    Srai 2/
```

---

## Daily use (kids)

1. Open the app URL in Chrome on the Chromebook
2. Select name → pick category → type piece name → Start
3. Sing — the green dot means your voice is being detected
4. Hit **Record for Teacher** before a piece you want to share
5. Hit **Stop** when done — session saves automatically
