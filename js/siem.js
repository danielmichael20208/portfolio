// ==============================
//   Daniel SIEM Dashboard Logic
// ==============================

let levelChartInstance = null;
let sourceChartInstance = null;
let timelineChartInstance = null;

let currentRange = "hour";    // "hour" or "day"
let autoMode = "manual";      // "manual" or "auto"
let autoIntervalId = null;

// ---------- DOM Helpers ----------
function $(id) {
  return document.getElementById(id);
}

async function loadLogs() {
  try {
    const res = await fetch("data/logs_web.json?" + Date.now());
    const events = await res.json();
    if (!Array.isArray(events)) return [];
    return events;
  } catch (err) {
    console.error("Error loading logs_web.json:", err);
    return [];
  }
}

// ---------- Aggregation & Scoring ----------
function aggregateData(events) {
  const levelCounts = {};
  const sourceCounts = {};
  const timelineCounts = {};

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  const alerts = [];

  events.forEach(ev => {
    const level = ev.level || "INFO";
    const source = ev.source || "unknown";
    const ts = ev.timestamp || "";
    const type = ev.event_type || "";

    // Level counts
    levelCounts[level] = (levelCounts[level] || 0) + 1;

    // Source counts
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;

    // Time bucket
    let bucket = "unknown";
    if (ts) {
      if (currentRange === "hour") {
        // 2026-01-14T02
        bucket = ts.slice(0, 13) + ":00";
      } else {
        // 2026-01-14
        bucket = ts.slice(0, 10);
      }
    }
    timelineCounts[bucket] = (timelineCounts[bucket] || 0) + 1;

    // Severity counters (rough mapping)
    if (level === "ERROR" || level === "ALERT" || level === "CRITICAL") {
      criticalCount++;
    } else if (level === "WARN" || level === "OPEN") {
      highCount++;
    } else if (level === "INFO") {
      lowCount++;
    } else {
      mediumCount++;
    }
  });

  // --- Detection rules for alerts (similar to terminal) ---
  const refused = events.filter(e => e.level === "WARN" && e.event_type === "PORT_REFUSED");
  if (refused.length >= 3) {
    alerts.push("Possible port scanning activity detected (>=3 refused ports).");
    highCount += 2;
  }

  const denied = events.filter(e => e.event_type === "DOOR_DENIED");
  if (denied.length >= 3) {
    alerts.push("Physical access brute force attempts detected on CyberDoor.");
    highCount += 3;
  }

  const weak = events.filter(e => e.event_type === "PASSWORD_RATED" && e.context && e.context.rating === "WEAK");
  if (weak.length >= 5) {
    alerts.push("Multiple weak passwords detected for user(s).");
    mediumCount += 2;
  }

  // --- Security Score ---
  // Start from 100, subtract based on severity
  let score = 100;
  score -= criticalCount * 8;
  score -= highCount * 4;
  score -= mediumCount * 2;
  score -= lowCount * 1;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // Risk badge label
  let riskLabel = "LOW";
  let riskColor = "#22c55e"; // green
  if (score < 30) {
    riskLabel = "CRITICAL";
    riskColor = "#ef4444"; // red
  } else if (score < 60) {
    riskLabel = "HIGH";
    riskColor = "#f97316"; // orange
  } else if (score < 80) {
    riskLabel = "ELEVATED";
    riskColor = "#eab308"; // yellow
  }

  const severityBuckets = {
    critical: criticalCount,
    high: highCount,
    medium: mediumCount,
    low: lowCount
  };

  return {
    levelCounts,
    sourceCounts,
    timelineCounts,
    alerts,
    score,
    riskLabel,
    riskColor,
    severityBuckets
  };
}

// ---------- UI Update ----------
function updateScoreAndAlerts(agg) {
  const scoreEl = $("security-score");
  const badgeEl = $("risk-badge");
  const alertList = $("alert-list");

  if (scoreEl) scoreEl.textContent = agg.score.toString();
  if (badgeEl) {
    badgeEl.textContent = agg.riskLabel;
    badgeEl.style.backgroundColor = agg.riskColor;
    badgeEl.style.color = "#020617";
  }

  if (alertList) {
    alertList.innerHTML = "";
    if (agg.alerts.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No active alerts detected.";
      alertList.appendChild(li);
    } else {
      agg.alerts.forEach(msg => {
        const li = document.createElement("li");
        li.textContent = "⚠ " + msg;
        alertList.appendChild(li);
      });
    }
  }
}

// ---------- Charts ----------
function buildOrUpdateCharts(agg) {
  const levelCtx = document.getElementById("levelChart");
  const sourceCtx = document.getElementById("sourceChart");
  const timelineCtx = document.getElementById("timelineChart");

  const levelLabels = Object.keys(agg.levelCounts);
  const levelData = Object.values(agg.levelCounts);

  const sourceLabels = Object.keys(agg.sourceCounts);
  const sourceData = Object.values(agg.sourceCounts);

  const timelineLabels = Object.keys(agg.timelineCounts).sort();
  const timelineData = timelineLabels.map(k => agg.timelineCounts[k]);

  // Shared options
  const commonAxisOptions = {
    ticks: { color: "#fde047" },
    grid: {
      color: "rgba(250,204,21,.2)",
      drawBorder: false
    }
  };

  // --- Level Chart (bar) ---
  if (levelCtx) {
    if (!levelChartInstance) {
      levelChartInstance = new Chart(levelCtx, {
        type: "bar",
        data: {
          labels: levelLabels,
          datasets: [{
            label: "Events by Level",
            data: levelData,
            backgroundColor: "rgba(250,204,21,0.6)",
            borderColor: "#facc15",
            borderWidth: 1
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} events`
              }
            }
          },
          scales: {
            x: commonAxisOptions,
            y: commonAxisOptions
          }
        }
      });
    } else {
      levelChartInstance.data.labels = levelLabels;
      levelChartInstance.data.datasets[0].data = levelData;
      levelChartInstance.update();
    }
  }

  // --- Source Chart (pie) ---
  if (sourceCtx) {
    if (!sourceChartInstance) {
      sourceChartInstance = new Chart(sourceCtx, {
        type: "pie",
        data: {
          labels: sourceLabels,
          datasets: [{
            label: "Events by Source",
            data: sourceData,
            backgroundColor: [
              "rgba(250,204,21,0.8)",
              "rgba(253,224,71,0.8)",
              "rgba(234,179,8,0.8)",
              "rgba(202,138,4,0.8)",
              "rgba(132,64,0,0.8)"
            ]
          }]
        },
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => {
                  const label = ctx.label || "";
                  const value = ctx.raw || 0;
                  return ` ${label}: ${value} events`;
                }
              }
            }
          }
        }
      });
    } else {
      sourceChartInstance.data.labels = sourceLabels;
      sourceChartInstance.data.datasets[0].data = sourceData;
      sourceChartInstance.update();
    }
  }

  // --- Timeline Chart (line) ---
  if (timelineCtx) {
    if (!timelineChartInstance) {
      timelineChartInstance = new Chart(timelineCtx, {
        type: "line",
        data: {
          labels: timelineLabels,
          datasets: [{
            label: "Events Over Time",
            data: timelineData,
            borderColor: "#facc15",
            backgroundColor: "rgba(250,204,21,0.25)",
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          plugins: {
            tooltip: {
              callbacks: {
                label: ctx => {
                  const x = ctx.label || "";
                  const y = ctx.raw || 0;
                  return ` ${x}: ${y} events`;
                }
              }
            }
          },
          scales: {
            x: commonAxisOptions,
            y: commonAxisOptions
          }
        }
      });
    } else {
      timelineChartInstance.data.labels = timelineLabels;
      timelineChartInstance.data.datasets[0].data = timelineData;
      timelineChartInstance.update();
    }
  }
}

// ---------- Export Charts ----------
function exportChartsAsPNG() {
  const link = document.createElement("a");
  link.download = "siem_timeline.png";
  if (timelineChartInstance) {
    link.href = timelineChartInstance.toBase64Image("image/png", 1.0);
    link.click();
  }
}

function exportChartsAsPDF() {
  // No PDF library (like jsPDF) in this project, so:
  // 1. Open PNG in new tab
  // 2. User can print to PDF via browser
  if (timelineChartInstance) {
    const img = timelineChartInstance.toBase64Image("image/png", 1.0);
    const win = window.open("");
    if (win) {
      win.document.write("<title>SIEM Timeline Export</title>");
      win.document.write("<img src='" + img + "' style='max-width:100%;' />");
      win.document.close();
    }
  }
}

// ---------- Refresh / Auto-Refresh ----------
async function refreshDashboard() {
  const events = await loadLogs();
  const agg = aggregateData(events);
  updateScoreAndAlerts(agg);
  buildOrUpdateCharts(agg);
}

function toggleAutoRefresh() {
  const refreshBtn = $("refresh-btn");
  if (!refreshBtn) return;

  if (autoMode === "manual") {
    // Switch to auto
    autoMode = "auto";
    refreshBtn.textContent = "Auto (5s) – Click to Pause";

    // Immediately refresh once
    refreshDashboard();

    autoIntervalId = setInterval(() => {
      refreshDashboard();
    }, 5000);
  } else {
    // Switch to manual
    autoMode = "manual";
    refreshBtn.textContent = "Refresh";
    if (autoIntervalId) {
      clearInterval(autoIntervalId);
      autoIntervalId = null;
    }
  }
}

// ---------- Time Range Controls ----------
function initRangeButtons() {
  const buttons = document.querySelectorAll(".chart-controls button[data-range]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-range");
      if (value === "hour" || value === "day") {
        currentRange = value;
        refreshDashboard();
      }
    });
  });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  // Initial load
  refreshDashboard();

  // Range buttons
  initRangeButtons();

  // Refresh / Auto button
  const refreshBtn = $("refresh-btn");
  if (refreshBtn) {
    refreshBtn.textContent = "Refresh";
    refreshBtn.addEventListener("click", () => {
      // When in manual, just refresh once.
      // When toggling, switch modes.
      if (autoMode === "manual") {
        // Single manual refresh
        refreshDashboard();
      } else {
        // If button clicked while auto, pause
        toggleAutoRefresh();
      }
    });

    // Right-click or Ctrl+Click toggles auto mode:
    refreshBtn.addEventListener("contextmenu", e => {
      e.preventDefault();
      toggleAutoRefresh();
    });
  }

  // Export buttons
  const exportPngBtn = $("export-png");
  if (exportPngBtn) {
    exportPngBtn.addEventListener("click", exportChartsAsPNG);
  }

  const exportPdfBtn = $("export-pdf");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", exportChartsAsPDF);
  }
});
