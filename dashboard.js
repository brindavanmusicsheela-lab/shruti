const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoOKBCWHN2N-dCRxrwoHVKTQy8pmoUwYuxrp-uGLbEMA2XKrHzIB7oSXPKPDo-nzF-/exec';

const CATEGORIES = [
  'Sarali Varisai', 'Janta Varisai', 'Tara Sthayi Varisai',
  'Alankarams', 'Geetham', 'Swarajathi', 'Varnam', 'Misc'
];

let currentChild = 'Srai 1';
let weekOffset   = 0;
let allSessions  = [];
let allLessons   = [];
let allAssignments = [];
let pendingAssignment = {}; // category → piece being edited in modal

window.addEventListener('DOMContentLoaded', loadData);

// ── Data ──────────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res  = await fetch('/.netlify/functions/proxy?action=getData');
    const data = await res.json();
    allSessions    = data.sessions    || [];
    allLessons     = data.lessons     || [];
    allAssignments = data.assignments || [];
    render();
  } catch (e) {
    showToast('Could not load data', 'error');
    renderDemo();
  }
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekBounds(offset) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
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

function switchChild(name, el) {
  currentChild = name;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  render();
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const { start, end } = getWeekBounds(weekOffset);

  const sessions = allSessions.filter(s =>
    s.child === currentChild &&
    new Date(s.date) >= start && new Date(s.date) <= end
  );

  const assignments = allAssignments.filter(a => a.child === currentChild);

  renderCurrentPiece();
  renderStats(sessions, assignments);
  renderAssignment(assignments, sessions);
  renderPieces(sessions, assignments);
  renderLessons();
  renderRecordings(sessions);
}

function renderCurrentPiece() {
  const lessons = allLessons.filter(l => l.child === currentChild);
  const current = lessons.find(l => l.isCurrent) ||
                  (lessons.length ? lessons.sort((a,b) => new Date(b.date) - new Date(a.date))[0] : null);

  const el = document.getElementById('current-piece-display');
  if (!current) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🎵</div>No current piece set</div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--primary)">${current.piece}</div>
        <div style="margin-top:4px"><span class="badge-category">${current.category}</span>
          <span style="font-size:0.8rem;color:var(--gray-500)">Since ${fmtDate(current.date)}</span>
        </div>
      </div>
      ${current.fileUrl ? `<a class="recording-link" href="${current.fileUrl}" target="_blank">🎵 Teacher Demo</a>` : ''}
    </div>`;
}

function renderStats(sessions, assignments) {
  const activeMins = sessions.reduce((a, s) => a + (s.activeMins || 0), 0);
  const days = new Set(sessions.map(s => new Date(s.date).toDateString())).size;

  // Completion: how many assigned pieces were practiced (with recording)
  const practiced = assignments.filter(a =>
    sessions.some(s => s.category === a.category && s.piece === a.piece && s.hasRecording)
  ).length;
  const total = assignments.length;
  const pct = total ? `${practiced}/${total}` : '—';

  document.getElementById('stat-completion').textContent = pct;
  document.getElementById('stat-active-mins').textContent = activeMins || '0';
  document.getElementById('stat-days').textContent = days || '0';
}

function renderAssignment(assignments, sessions) {
  const el = document.getElementById('assignment-list');
  if (!assignments.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📋</div>No assignment set — click Edit to set one</div>`;
    return;
  }

  el.innerHTML = assignments.map(a => {
    const done = sessions.some(s =>
      s.category === a.category && s.piece === a.piece && s.hasRecording
    );
    const practiced = sessions.some(s => s.category === a.category && s.piece === a.piece);
    return `
      <div class="piece-row">
        <div class="piece-info">
          <div class="piece-name">${a.piece}</div>
          <div class="piece-category">
            <span class="badge-category">${a.category}</span>
            ${a.setBy === 'ai' ? '<span class="badge-ai">✨ AI</span>' : ''}
          </div>
        </div>
        <div style="text-align:right">
          ${done
            ? '<span class="status-pill done">✅ Recorded</span>'
            : practiced
              ? '<span class="status-pill partial">🎵 Practiced</span>'
              : '<span class="status-pill pending">⏳ Pending</span>'
          }
        </div>
      </div>`;
  }).join('');
}

function renderPieces(sessions, assignments) {
  const el = document.getElementById('piece-list');
  if (!sessions.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">😴</div>No practice logged this week</div>`;
    return;
  }

  const map = {};
  sessions.forEach(s => {
    const key = `${s.category}||${s.piece}`;
    if (!map[key]) map[key] = { category: s.category, piece: s.piece, totalMins: 0, activeMins: 0, sessions: 0, hasRecording: false };
    map[key].totalMins  += s.totalMins || 0;
    map[key].activeMins += s.activeMins || 0;
    map[key].sessions++;
    if (s.hasRecording) map[key].hasRecording = true;
  });

  const assignedKeys = new Set(assignments.map(a => `${a.category}||${a.piece}`));

  el.innerHTML = Object.values(map)
    .sort((a, b) => b.activeMins - a.activeMins)
    .map(r => {
      const isAssigned = assignedKeys.has(`${r.category}||${r.piece}`);
      return `
        <div class="piece-row">
          <div class="piece-info">
            <div class="piece-name">${r.piece} ${isAssigned ? '📌' : ''}</div>
            <div class="piece-category">
              <span class="badge-category">${r.category}</span>
              ${r.sessions} session${r.sessions > 1 ? 's' : ''}
              ${r.hasRecording ? ' · 🎙 recorded' : ''}
            </div>
          </div>
          <div>
            <div class="piece-mins">${r.activeMins} min active</div>
            <div style="font-size:0.75rem;color:var(--gray-500);text-align:right">${r.totalMins} min total</div>
          </div>
        </div>`;
    }).join('');
}

function renderLessons() {
  const el = document.getElementById('lesson-list');
  const lessons = allLessons
    .filter(l => l.child === currentChild && !l.isCurrent)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!lessons.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📚</div>No previous lessons</div>`;
    return;
  }
  el.innerHTML = lessons.map(l => `
    <div class="lesson-row">
      <div class="lesson-date">${fmtDate(l.date)}</div>
      <div class="lesson-piece">${l.piece}</div>
      <div class="lesson-category"><span class="badge-category">${l.category}</span></div>
      ${l.fileUrl ? `<a class="recording-link" href="${l.fileUrl}" target="_blank">🎵 Listen</a>` : ''}
      ${l.notes ? `<div style="font-size:0.82rem;color:var(--gray-500);margin-top:4px">${l.notes}</div>` : ''}
    </div>`).join('');
}

function renderRecordings(sessions) {
  const el = document.getElementById('recordings-list');
  const recordings = sessions.filter(s => s.hasRecording && s.recordingUrl);
  if (!recordings.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🎙</div>No recordings this week</div>`;
    return;
  }
  el.innerHTML = recordings.map(r => `
    <div class="lesson-row">
      <div class="lesson-date">${fmtDate(r.date)}</div>
      <div class="lesson-piece">${r.piece} ${r.isAssigned ? '📌' : ''}</div>
      <div class="lesson-category"><span class="badge-category">${r.category}</span></div>
      <a class="recording-link" href="${r.recordingUrl}" target="_blank">🎙 Listen</a>
    </div>`).join('');
}

// ── Assignment modal ──────────────────────────────────────────────────────────
function openAssignModal() {
  pendingAssignment = {};
  // Pre-fill with current assignments
  allAssignments.filter(a => a.child === currentChild).forEach(a => {
    pendingAssignment[a.category] = { piece: a.piece, setBy: a.setBy };
  });
  renderAssignForm();
  document.getElementById('assign-modal').style.display = 'flex';
}

function closeAssignModal() {
  document.getElementById('assign-modal').style.display = 'none';
}

function renderAssignForm() {
  // Build category → pieces from ALL lessons for this child
  const catMap = {};
  allLessons.forEach(l => {
    if (l.child !== currentChild || !l.category || !l.piece) return;
    if (!catMap[l.category]) catMap[l.category] = new Set();
    catMap[l.category].add(l.piece);
  });

  // Carnatic syllabus order keywords
  const order = ['sarale','saral','sarali','janti','janta','alankara','dhatu','geetam','geetham','lakshana','swarajathi','varnam','misc'];

  const cats = Object.keys(catMap).sort((a, b) => {
    const al = a.toLowerCase();
    const bl = b.toLowerCase();
    const ai = order.findIndex(o => al.includes(o));
    const bi = order.findIndex(o => bl.includes(o));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const form = document.getElementById('assign-form');
  form.innerHTML = cats.map(cat => {
    const pieces  = [...catMap[cat]].sort();
    const current = pendingAssignment[cat];
    return `
      <div class="assign-row" style="margin-bottom:10px">
        <div class="assign-cat"><span class="badge-category">${cat}</span></div>
        <select class="assign-select" data-category="${cat}" onchange="onAssignChange(this)">
          <option value="">— skip —</option>
          ${pieces.map(p => `<option value="${p}" ${current && current.piece === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>`;
  }).join('');

  if (!cats.length) {
    form.innerHTML = '<div style="color:var(--gray-500);font-size:0.9rem">No lessons found for this student yet.</div>';
  }
}

function onAssignChange(sel) {
  const cat = sel.dataset.category;
  if (sel.value) {
    pendingAssignment[cat] = { piece: sel.value, setBy: 'teacher' };
  } else {
    delete pendingAssignment[cat];
  }
}

async function loadAiSuggestions() {
  showToast('Getting AI suggestions…', '');
  try {
    const res  = await fetch(`/.netlify/functions/proxy?action=getAiSuggestions&child=${encodeURIComponent(currentChild)}`);
    const data = await res.json();
    const sugg = data.suggestions || {};
    Object.entries(sugg).forEach(([cat, item]) => {
      if (!pendingAssignment[cat]) {
        pendingAssignment[cat] = { piece: item.piece, setBy: 'ai' };
      }
    });
    renderAssignForm();
    showToast('AI suggestions loaded — review and save', 'success');
  } catch (e) {
    showToast('Could not load suggestions', 'error');
  }
}

async function saveAssignment() {
  const assignments = Object.entries(pendingAssignment).map(([cat, val]) => ({
    category: cat, piece: val.piece
  }));

  if (!assignments.length) {
    showToast('Add at least one piece', 'error');
    return;
  }

  const payload = { action: 'setAssignment', child: currentChild, assignments, setBy: 'teacher' };
  const form = new FormData();
  form.append('data', JSON.stringify(payload));

  try {
    await fetch(APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: form });
    allAssignments = allAssignments.filter(a => a.child !== currentChild);
    assignments.forEach(a => allAssignments.push({ child: currentChild, ...a, setBy: pendingAssignment[a.category].setBy }));
    closeAssignModal();
    render();
    showToast('Assignment saved!', 'success');
  } catch (e) {
    showToast('Could not save', 'error');
  }
}

// ── Demo mode ─────────────────────────────────────────────────────────────────
function renderDemo() {
  const today = new Date();
  const d = n => { const x = new Date(today); x.setDate(today.getDate() - n); return x.toISOString(); };

  allSessions = [
    { child: 'Srai 1', category: 'Varnam', piece: 'Kalyani Varnam', date: d(0), totalMins: 22, activeMins: 18, hasRecording: true, recordingUrl: '#', isAssigned: true },
    { child: 'Srai 1', category: 'Geetham', piece: 'Malahari Geetham', date: d(1), totalMins: 15, activeMins: 12, hasRecording: false, isAssigned: true },
    { child: 'Srai 2', category: 'Varnam', piece: 'Mohana Varnam', date: d(0), totalMins: 18, activeMins: 14, hasRecording: true, recordingUrl: '#', isAssigned: true },
  ];
  allLessons = [
    { child: 'Srai 1', category: 'Varnam', piece: 'Kalyani Varnam', date: d(7), notes: 'Work on charanam', fileUrl: '#', isCurrent: true },
    { child: 'Srai 1', category: 'Geetham', piece: 'Malahari Geetham', date: d(30), notes: '', fileUrl: '#', isCurrent: false },
    { child: 'Srai 2', category: 'Varnam', piece: 'Mohana Varnam', date: d(7), notes: 'Pallavi only', fileUrl: '#', isCurrent: true },
  ];
  allAssignments = [
    { child: 'Srai 1', category: 'Varnam', piece: 'Kalyani Varnam', setBy: 'teacher' },
    { child: 'Srai 1', category: 'Geetham', piece: 'Malahari Geetham', setBy: 'ai' },
    { child: 'Srai 2', category: 'Varnam', piece: 'Mohana Varnam', setBy: 'teacher' },
  ];
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
