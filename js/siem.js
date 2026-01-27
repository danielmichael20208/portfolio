let autoRefresh = true;
let refreshInterval = null;

// === MAIN RENDER FUNCTION ===
async function renderSIEM() {
  const res = await fetch("data/logs_web.json?" + Date.now());
  const events = await res.json();

  // === Security Score ===
  const weights = { INFO:1, WARN:3, ALERT:6 };
  let total = 0;
  events.forEach(e => total += weights[e.level] || 1);
  const score = Math.max(0, 100 - total);
  document.getElementById("security-score").textContent = score + "/100";

  const risk = document.getElementById("risk-badge");
  if (score >= 85) risk.textContent = "LOW RISK";
  else if (score >= 60) risk.textContent = "ELEVATED";
  else risk.textContent = "HIGH";

  // === Alerts List ===
  const alertList = document.getElementById("alert-list");
  alertList.innerHTML = "";
  events.filter(e => e.level !== "INFO").slice(-5).reverse().forEach(e => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>[${e.level}]</strong> ${e.message}`;
    alertList.appendChild(li);
  });

  // === Aggregates ===
  const levelCounts = {}, sourceCounts = {}, timelineCounts = {};
  events.forEach(e => {
    levelCounts[e.level] = (levelCounts[e.level] || 0)+1;
    sourceCounts[e.source] = (sourceCounts[e.source] || 0)+1;
    const ts = e.timestamp.slice(0,13)+":00";
    timelineCounts[ts]=(timelineCounts[ts]||0)+1;
  });

  // === Destroy old charts before redraw ===
  if (window.levelChartObj) window.levelChartObj.destroy();
  if (window.sourceChartObj) window.sourceChartObj.destroy();
  if (window.timelineChartObj) window.timelineChartObj.destroy();

 // === Dark Gold Theme Preset ===
const DARK_GOLD = {
  text: "#f8f8f8",
  gold: "#facc15",
  grid: "rgba(250,204,21,0.25)"
};

// === Severity Chart (Bar) ===
window.levelChartObj = new Chart(levelChart, {
  type: "bar",
  data: {
    labels: Object.keys(levelCounts),
    datasets: [{
      data: Object.values(levelCounts),
      backgroundColor: DARK_GOLD.gold
    }]
  },
  options: {
    plugins: {
      legend: { display: false },
      tooltip: {
        bodyColor: DARK_GOLD.text,
        titleColor: DARK_GOLD.gold
      }
    },
    scales: {
      x: {
        ticks: { color: DARK_GOLD.text },
        grid: { color: DARK_GOLD.grid }
      },
      y: {
        ticks: { color: DARK_GOLD.text },
        grid: { color: DARK_GOLD.grid }
      }
    }
  }
});

// === Source Chart (Pie) ===
window.sourceChartObj = new Chart(sourceChart, {
  type: "pie",
  data: {
    labels: Object.keys(sourceCounts),
    datasets: [{
      data: Object.values(sourceCounts),
      backgroundColor: [
        DARK_GOLD.gold,
        "#d4b72c",
        "#b3951f",
        "#8e7419"
      ]
    }]
  },
  options: {
    plugins: {
      legend: {
        labels: { color: DARK_GOLD.text }
      }
    }
  }
});

// === Timeline Chart (Line) ===
const keys = Object.keys(timelineCounts).sort();
window.timelineChartObj = new Chart(timelineChart, {
  type: "line",
  data: {
    labels: keys,
    datasets: [{
      data: keys.map(k => timelineCounts[k]),
      borderColor: DARK_GOLD.gold,
      pointBackgroundColor: DARK_GOLD.gold,
      borderWidth: 2,
      tension: 0.25,
      fill: false
    }]
  },
  options: {
    plugins: {
      legend: { display: false },
      tooltip: {
        bodyColor: DARK_GOLD.text,
        titleColor: DARK_GOLD.gold
      }
    },
    scales: {
      x: {
        ticks: { color: DARK_GOLD.text },
        grid: { color: DARK_GOLD.grid }
      },
      y: {
        ticks: { color: DARK_GOLD.text },
        grid: { color: DARK_GOLD.grid }
      }
    }
  }
});

// === AUTO REFRESH SYSTEM ===
function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (autoRefresh) renderSIEM();
  }, 10000); // every 10 seconds
}

// === Toggle Handling ===
document.getElementById("auto-refresh-toggle").addEventListener("change", e => {
  autoRefresh = e.target.checked;
  document.getElementById("refresh-status").textContent = autoRefresh ? "ON" : "OFF";
});

// === Manual Refresh ===
document.getElementById("manual-refresh").addEventListener("click", renderSIEM);

// === Initial Load ===
renderSIEM();
startAutoRefresh();
