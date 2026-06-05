// ── Config ────────────────────────────────────────────────────────────────────
// Replace with your deployed Google Apps Script Web App URL after setup
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoOKBCWHN2N-dCRxrwoHVKTQy8pmoUwYuxrp-uGLbEMA2XKrHzIB7oSXPKPDo-nzF-/exec';

// Mic activity threshold (0–255). Sound above this counts as "singing".
const ACTIVITY_THRESHOLD = 18;
// Seconds of silence before timer pauses
const SILENCE_PAUSE_AFTER = 8;

// ── State ─────────────────────────────────────────────────────────────────────
let selectedChild = null;
let selectedCategory = null;
let selectedPiece = null;

let timerInterval = null;
let totalSeconds = 0;
let activeSeconds = 0;
let silentStreak = 0; // consecutive silent seconds
let sessionRunning = false;

let audioContext = null;
let analyser = null;
let micStream = null;
let animFrame = null;

let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

// ── Child selection ────────────────────────────────────────────────────────────
function selectChild(name) {
  selectedChild = name;
  document.getElementById('btn-srai1').classList.toggle('selected', name === 'Srai 1');
  document.getElementById('btn-srai2').classList.toggle('selected', name === 'Srai 2');
  show('step-piece');
  document.getElementById('category-select').value = '';
  document.getElementById('piece-field').style.display = 'none';
  document.getElementById('confirm-piece-btn').style.display = 'none';
}

// ── Piece selection ────────────────────────────────────────────────────────────
function onCategoryChange() {
  const cat = document.getElementById('category-select').value;
  selectedCategory = cat;
  const pieceField = document.getElementById('piece-field');
  const confirmBtn = document.getElementById('confirm-piece-btn');
  if (cat) {
    pieceField.style.display = 'block';
    confirmBtn.style.display = 'block';
    document.getElementById('piece-input').value = '';
    document.getElementById('piece-input').focus();
  } else {
    pieceField.style.display = 'none';
    confirmBtn.style.display = 'none';
  }
}

function confirmPiece() {
  const piece = document.getElementById('piece-input').value.trim();
  if (!piece) {
    showToast('Please enter the piece name', 'error');
    return;
  }
  selectedPiece = piece;
  document.getElementById('session-label').textContent =
    `${selectedChild}  ·  ${selectedCategory}  ·  ${selectedPiece}`;
  show('step-timer');
  hide('step-piece');
}

// ── Session ────────────────────────────────────────────────────────────────────
async function startSession() {
  if (!selectedChild || !selectedPiece) return;

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (e) {
    showToast('Microphone permission needed to track practice', 'error');
    return;
  }

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  const source = audioContext.createMediaStreamSource(micStream);
  source.connect(analyser);

  totalSeconds = 0;
  activeSeconds = 0;
  silentStreak = 0;
  sessionRunning = true;
  isRecording = false;
  recordedChunks = [];

  document.getElementById('controls-ready').style.display = 'none';
  document.getElementById('controls-active').style.display = 'grid';

  timerInterval = setInterval(tickTimer, 1000);
  monitorMic();

  updateStatus('listening', 'Listening…');
}

function tickTimer() {
  if (!sessionRunning) return;
  totalSeconds++;
  updateClock();
}

function monitorMic() {
  if (!sessionRunning) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

  // Activity bar fill
  const fillPct = Math.min(100, (avg / 80) * 100);
  document.getElementById('activity-fill').style.width = fillPct + '%';

  if (avg > ACTIVITY_THRESHOLD) {
    activeSeconds++;
    silentStreak = 0;
    updateStatus('active', 'Singing detected');
    document.getElementById('activity-fill').style.background = 'var(--active)';
  } else {
    silentStreak++;
    if (silentStreak > SILENCE_PAUSE_AFTER) {
      updateStatus('silent', 'Silence… keep going!');
      document.getElementById('activity-fill').style.background = 'var(--warning)';
    }
  }

  document.getElementById('active-minutes-display').textContent =
    activeSeconds >= 60
      ? `${Math.floor(activeSeconds / 60)}m ${activeSeconds % 60}s active singing`
      : `${activeSeconds}s active singing`;

  animFrame = setTimeout(monitorMic, 1000);
}

function toggleRecording() {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
}

function startRecording() {
  if (!micStream) return;
  recordedChunks = [];
  const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : {};
  mediaRecorder = new MediaRecorder(micStream, options);
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.start();
  isRecording = true;
  document.getElementById('record-btn').textContent = '⏹ Stop Recording';
  document.getElementById('record-btn').style.background = 'var(--danger)';
  document.getElementById('recording-badge').style.display = 'block';
}

function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  isRecording = false;
  document.getElementById('record-btn').textContent = '⏺ Record for Teacher';
  document.getElementById('record-btn').style.background = '';
  document.getElementById('recording-badge').style.display = 'none';
  showToast('Recording saved — will upload when you stop', 'success');
}

async function stopSession() {
  if (!sessionRunning) return;
  sessionRunning = false;
  clearInterval(timerInterval);
  clearTimeout(animFrame);

  if (isRecording) stopRecording();

  // Stop mic
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();

  document.getElementById('controls-active').style.display = 'none';
  document.getElementById('activity-fill').style.width = '0%';

  const totalMins = Math.round(totalSeconds / 60);
  const activeMins = Math.round(activeSeconds / 60);

  showSummary(totalMins, activeMins);
  await saveSession(totalMins, activeMins);
}

// ── Summary ────────────────────────────────────────────────────────────────────
function showSummary(totalMins, activeMins) {
  const hasRecording = recordedChunks.length > 0;
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  document.getElementById('summary-content').innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Child</span>
      <span class="summary-value">${selectedChild}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Category</span>
      <span class="summary-value">${selectedCategory}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Piece</span>
      <span class="summary-value">${selectedPiece}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Date</span>
      <span class="summary-value">${date}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Total time</span>
      <span class="summary-value">${totalMins} min</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Active singing</span>
      <span class="summary-value" style="color:var(--active)">${activeMins} min</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Recording for teacher</span>
      <span class="summary-value">${hasRecording ? '✅ Yes' : '—'}</span>
    </div>
  `;

  hide('step-timer');
  show('step-summary');
}

// ── Save to Google Sheets ──────────────────────────────────────────────────────
async function saveSession(totalMins, activeMins) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    showToast('Setup needed: add your Apps Script URL in app.js', 'error');
    return;
  }

  const payload = {
    action: 'logSession',
    child: selectedChild,
    category: selectedCategory,
    piece: selectedPiece,
    date: new Date().toISOString(),
    totalMins,
    activeMins,
    hasRecording: recordedChunks.length > 0,
  };

  try {
    // Upload recording if exists
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise(resolve => { reader.onloadend = resolve; });
      payload.recording = reader.result; // base64 data URL
      payload.recordingMime = mediaRecorder.mimeType || 'audio/webm';
    }

    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: form,
    });

    showToast('Session saved!', 'success');
  } catch (e) {
    showToast('Could not save — check connection', 'error');
    console.error(e);
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function practiceAnother() {
  hide('step-summary');
  selectedCategory = null;
  selectedPiece = null;
  document.getElementById('category-select').value = '';
  document.getElementById('piece-input').value = '';
  document.getElementById('piece-field').style.display = 'none';
  document.getElementById('confirm-piece-btn').style.display = 'none';
  document.getElementById('timer-clock').textContent = '00:00';
  document.getElementById('active-minutes-display').textContent = '';
  document.getElementById('status-text').textContent = 'Ready to start';
  document.getElementById('status-dot').className = 'status-dot';
  document.getElementById('controls-ready').style.display = 'block';
  document.getElementById('controls-active').style.display = 'none';
  show('step-piece');
  show('step-timer');
}

function resetAll() {
  location.reload();
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function show(id) { document.getElementById(id).style.display = 'block'; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

function updateClock() {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  document.getElementById('timer-clock').textContent = `${m}:${s}`;
}

function updateStatus(type, text) {
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot ' + type;
  document.getElementById('status-text').textContent = text;
}

let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}
