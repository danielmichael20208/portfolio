const GOLD     = '#c9a84c';
const GOLD_DIM = 'rgba(201,168,76,0.2)';
const TEXT     = '#f0ede6';
const MUTED    = '#7a7870';
const GREEN    = '#3ddc84';
const RED      = '#e05050';

let autoRefresh    = true;
let refreshInterval = null;
let cachedEvents   = [];

let levelChart    = null;
let sourceChart   = null;
let timelineChart = null;

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchLogs() {
  const res = await fetch('data/logs_web.json?' + Date.now());
  return res.json();
}

// ── Score ──────────────────────────────────────────────────────────────────
function computeScore(events) {
  const w = { INFO: 1, WARN: 3, ALERT: 6 };
  const total = events.reduce((s, e) => s + (w[e.level] || 1), 0);
  return Math.max(0, 100 - total);
}

// ── Render ─────────────────────────────────────────────────────────────────
function render(events) {
  cachedEvents = events;

  // Score
  const score = computeScore(events);
  document.getElementById('security-score').textContent = score;
  const riskEl = document.getElementById('risk-badge');
  if (score >= 85) {
    riskEl.textContent = 'LOW RISK';
    riskEl.className = 'score-risk risk-low';
  } else if (score >= 60) {
    riskEl.textContent = 'ELEVATED';
    riskEl.className = 'score-risk risk-elevated';
  } else {
    riskEl.textContent = 'HIGH RISK';
    riskEl.className = 'score-risk risk-high';
  }

  // Stats
  const alertCount = events.filter(e => e.level === 'ALERT' || e.level === 'WARN').length;
  document.getElementById('stat-total').textContent   = events.length;
  document.getElementById('stat-alerts').textContent  = alertCount;
  document.getElementById('stat-sources').textContent = new Set(events.map(e => e.source)).size;

  // Recent alerts list (WARN + ALERT, newest first, capped at 8)
  const alertList = document.getElementById('alert-list');
  alertList.innerHTML = '';
  const flagged = events.filter(e => e.level !== 'INFO').slice(-8).reverse();
  if (flagged.length === 0) {
    alertList.innerHTML = '<li class="alert-empty">No warnings or alerts — system nominal</li>';
  } else {
    flagged.forEach(e => {
      const li = document.createElement('li');
      li.className = 'alert-item';
      const ts = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      li.innerHTML =
        `<span class="alert-badge badge-${e.level.toLowerCase()}">${e.level}</span>` +
        `<span class="alert-src">${e.source}</span>` +
        `<span class="alert-msg">${e.message}</span>` +
        `<span class="alert-ts">${ts}</span>`;
      alertList.appendChild(li);
    });
  }

  // Aggregates for charts
  const levelCounts   = {};
  const sourceCounts  = {};
  const timelineCounts = {};
  events.forEach(e => {
    levelCounts[e.level]   = (levelCounts[e.level]   || 0) + 1;
    sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
    const bucket = e.timestamp.slice(0, 13) + ':00';
    timelineCounts[bucket] = (timelineCounts[bucket] || 0) + 1;
  });

  drawLevelChart(levelCounts);
  drawSourceChart(sourceCounts);
  drawTimelineChart(timelineCounts);

  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

// ── Charts ─────────────────────────────────────────────────────────────────
const baseScales = {
  x: {
    ticks: { color: MUTED, font: { family: "'Share Tech Mono'", size: 11 } },
    grid:  { color: GOLD_DIM }
  },
  y: {
    ticks: { color: MUTED, font: { family: "'Share Tech Mono'", size: 11 } },
    grid:  { color: GOLD_DIM }
  }
};

function drawLevelChart(counts) {
  if (levelChart) levelChart.destroy();
  const colorMap = { INFO: GREEN, WARN: GOLD, ALERT: RED };
  levelChart = new Chart(document.getElementById('levelChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: Object.keys(counts).map(k => colorMap[k] || GOLD),
        borderWidth: 0,
        borderRadius: 2
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { bodyColor: TEXT, titleColor: GOLD, backgroundColor: '#1a1a22' }
      },
      scales: baseScales
    }
  });
}

function drawSourceChart(counts) {
  if (sourceChart) sourceChart.destroy();
  const palette = [GOLD, '#d4b72c', '#b3951f', '#8e7419', '#6a5010'];
  sourceChart = new Chart(document.getElementById('sourceChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: palette.slice(0, Object.keys(counts).length),
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: {
          labels: { color: TEXT, font: { family: "'Share Tech Mono'", size: 11 }, boxWidth: 12 }
        },
        tooltip: { bodyColor: TEXT, titleColor: GOLD, backgroundColor: '#1a1a22' }
      },
      cutout: '62%'
    }
  });
}

function drawTimelineChart(counts) {
  if (timelineChart) timelineChart.destroy();
  const keys   = Object.keys(counts).sort();
  const labels = keys.map(k => k.slice(11, 16));
  timelineChart = new Chart(document.getElementById('timelineChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: keys.map(k => counts[k]),
        borderColor: GOLD,
        pointBackgroundColor: GOLD,
        pointRadius: 4,
        borderWidth: 2,
        tension: 0.3,
        fill: { target: 'origin', above: 'rgba(201,168,76,0.06)' }
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { bodyColor: TEXT, titleColor: GOLD, backgroundColor: '#1a1a22' }
      },
      scales: baseScales
    }
  });
}

// ── Empty state ────────────────────────────────────────────────────────────
function showEmpty() {
  ['security-score','stat-total','stat-alerts','stat-sources'].forEach(id => {
    document.getElementById(id).textContent = '0';
  });
  document.getElementById('risk-badge').textContent = '—';
  document.getElementById('alert-list').innerHTML =
    '<li class="alert-empty">No event data — run a Python tool to generate logs</li>';
  document.getElementById('last-updated').textContent = 'No data';
}

// ── Load ───────────────────────────────────────────────────────────────────
async function loadAndRender() {
  try {
    const events = await fetchLogs();
    if (!Array.isArray(events) || events.length === 0) { showEmpty(); return; }
    render(events);
  } catch (_) {
    showEmpty();
  }
}

// ── Auto-refresh ───────────────────────────────────────────────────────────
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => { if (autoRefresh) loadAndRender(); }, 10000);
}

// ── Controls ───────────────────────────────────────────────────────────────
document.getElementById('auto-refresh-toggle').addEventListener('change', e => {
  autoRefresh = e.target.checked;
  document.getElementById('refresh-status').textContent = autoRefresh ? 'ON' : 'OFF';
});

document.getElementById('manual-refresh').addEventListener('click', loadAndRender);

document.getElementById('export-png').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'siem-timeline.png';
  link.href = document.getElementById('timelineChart').toDataURL();
  link.click();
});

document.getElementById('export-csv').addEventListener('click', () => {
  if (!cachedEvents.length) return;
  const rows = ['timestamp,level,source,event_type,message']
    .concat(cachedEvents.map(e =>
      [e.timestamp, e.level, e.source, e.event_type || '', `"${(e.message || '').replace(/"/g, '""')}"`].join(',')
    ));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.download = 'siem-events.csv';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
});

// ── Init ───────────────────────────────────────────────────────────────────
loadAndRender();
startAutoRefresh();
