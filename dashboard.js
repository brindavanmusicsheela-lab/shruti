// ── Config ────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoOKBCWHN2N-dCRxrwoHVKTQy8pmoUwYuxrp-uGLbEMA2XKrHzIB7oSXPKPDo-nzF-/exec';

// ── State ─────────────────────────────────────────────────────────────────────
let currentChild = 'Srai 1';
let weekOffset = 0; // 0 = this week, -1 = last week, etc.
let allSessions = [];
let allLessons = [];

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadData();
});

async function loadData() {
  if (APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    renderDemo();
    return;
  }
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getData`);
    const data = await res.json();
    allSessions = data.sessions || [];
    allLessons = data.lessons || [];
    render();
  } catch (e) {
    showToast('Could not load data', 'error');
    renderDemo();
  }
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekBounds(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - day + (offset * 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { start: startOfWeek, end: endOfWeek };
}

function weekLabel(offset) {
  if (offset === 0) return 'This Week';
  if (offset === -1) return 'Last Week';
  const { start, end } = getWeekBounds(offset);
  const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function changeWeek(dir) {
  weekOffset += dir;
  if (weekOffset > 0) weekOffset = 0;
  document.getElementById('next-week-btn').disabled = weekOffset === 0;
  document.getElementById('week-label').textContent = weekLabel(weekOffset);
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────
function switchChild(name, el) {
  currentChild = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  render();
}

function render() {
  const { start, end } = getWeekBounds(weekOffset);

  const sessions = allSessions.filter(s =>
    s.child === currentChild &&
    new Date(s.date) >= start &&
    new Date(s.date) <= end
  );

  // Stats
  const totalMins = sessions.reduce((a, s) => a + (s.totalMins || 0), 0);
  const activeMins = sessions.reduce((a, s) => a + (s.activeMins || 0), 0);
  const days = new Set(sessions.map(s => new Date(s.date).toDateString())).size;

  document.getElementById('stat-total-mins').textContent = totalMins || '0';
  document.getElementById('stat-active-mins').textContent = activeMins || '0';
  document.getElementById('stat-days').textContent = days || '0';

  // Pieces
  renderPieces(sessions);

  // Lessons
  const lessons = allLessons.filter(l => l.child === currentChild);
  renderLessons(lessons);

  // Recordings
  const recordings = sessions.filter(s => s.hasRecording && s.recordingUrl);
  renderRecordings(recordings);
}

function renderPieces(sessions) {
  const el = document.getElementById('piece-list');
  if (!sessions.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">😴</div>No practice logged this week</div>`;
    return;
  }

  // Group by category + piece
  const map = {};
  sessions.forEach(s => {
    const key = `${s.category}||${s.piece}`;
    if (!map[key]) map[key] = { category: s.category, piece: s.piece, totalMins: 0, activeMins: 0, sessions: 0 };
    map[key].totalMins += s.totalMins || 0;
    map[key].activeMins += s.activeMins || 0;
    map[key].sessions++;
  });

  const rows = Object.values(map).sort((a, b) => b.activeMins - a.activeMins);

  el.innerHTML = rows.map(r => `
    <div class="piece-row">
      <div class="piece-info">
        <div class="piece-name">${r.piece}</div>
        <div class="piece-category">
          <span class="badge-category">${r.category}</span>
          ${r.sessions} session${r.sessions > 1 ? 's' : ''}
        </div>
      </div>
      <div>
        <div class="piece-mins">${r.activeMins} min active</div>
        <div style="font-size:0.75rem;color:var(--gray-500);text-align:right">${r.totalMins} min total</div>
      </div>
    </div>
  `).join('');
}

function renderLessons(lessons) {
  const el = document.getElementById('lesson-list');
  if (!lessons.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📚</div>No lessons recorded yet</div>`;
    return;
  }
  const sorted = [...lessons].sort((a, b) => new Date(b.date) - new Date(a.date));
  el.innerHTML = sorted.map(l => `
    <div class="lesson-row">
      <div class="lesson-date">${fmtDate(l.date)}</div>
      <div class="lesson-piece">${l.piece}</div>
      <div class="lesson-category"><span class="badge-category">${l.category}</span></div>
      ${l.fileUrl ? `<a class="recording-link" href="${l.fileUrl}" target="_blank">🎵 Listen</a>` : ''}
      ${l.notes ? `<div style="font-size:0.82rem;color:var(--gray-500);margin-top:4px">${l.notes}</div>` : ''}
    </div>
  `).join('');
}

function renderRecordings(recordings) {
  const el = document.getElementById('recordings-list');
  if (!recordings.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🎙</div>No recordings this week</div>`;
    return;
  }
  el.innerHTML = recordings.map(r => `
    <div class="lesson-row">
      <div class="lesson-date">${fmtDate(r.date)}</div>
      <div class="lesson-piece">${r.piece}</div>
      <div class="lesson-category"><span class="badge-category">${r.category}</span></div>
      <a class="recording-link" href="${r.recordingUrl}" target="_blank">🎙 Listen</a>
    </div>
  `).join('');
}

// ── Demo mode (no backend) ────────────────────────────────────────────────────
function renderDemo() {
  const today = new Date();
  const d = n => { const x = new Date(today); x.setDate(today.getDate() - n); return x.toISOString(); };

  allSessions = [
    { child: 'Srai 1', category: 'Geetham', piece: 'Malahari Geetham', date: d(0), totalMins: 22, activeMins: 18, hasRecording: true, recordingUrl: '#' },
    { child: 'Srai 1', category: 'Sarali Varisai', piece: 'Sarali 1–7', date: d(1), totalMins: 15, activeMins: 12, hasRecording: false },
    { child: 'Srai 1', category: 'Geetham', piece: 'Malahari Geetham', date: d(2), totalMins: 20, activeMins: 17, hasRecording: false },
    { child: 'Srai 2', category: 'Sarali Varisai', piece: 'Sarali 1–5', date: d(0), totalMins: 18, activeMins: 14, hasRecording: false },
    { child: 'Srai 2', category: 'Alankarams', piece: 'Alankaram 1', date: d(1), totalMins: 12, activeMins: 10, hasRecording: true, recordingUrl: '#' },
  ];

  allLessons = [
    { child: 'Srai 1', category: 'Geetham', piece: 'Malahari Geetham', date: d(3), notes: 'Focus on the madhyamakala sahitya', fileUrl: '#' },
    { child: 'Srai 2', category: 'Alankarams', piece: 'Alankaram 1 & 2', date: d(3), notes: 'Practice with metronome at 60 bpm', fileUrl: '#' },
  ];

  showToast('Demo mode — add your Apps Script URL to see real data', '');
  render();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 4000);
}
