(async function() {
  const res = await fetch("data/logs_web.json?" + Date.now());
  const events = await res.json();

  // === Security Score Calculation ===
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
  events.filter(e => e.level !== "INFO").slice(-5).reverse().forEach(e => {
    const li = document.createElement("li");
    li.textContent = `[${e.level}] ${e.message}`;
    alertList.appendChild(li);
  });

  // === Aggregate Charts ===
  const levelCounts = {}, sourceCounts = {}, timelineCounts = {};
  events.forEach(e => {
    levelCounts[e.level] = (levelCounts[e.level] || 0)+1;
    sourceCounts[e.source] = (sourceCounts[e.source] || 0)+1;
    const ts = e.timestamp.slice(0,13)+":00";
    timelineCounts[ts]=(timelineCounts[ts]||0)+1;
  });

  new Chart(levelChart, {
    type:"bar",
    data:{ labels:Object.keys(levelCounts), datasets:[{ data:Object.values(levelCounts), backgroundColor:"#facc15"}]},
    options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:"#facc15"}}, y:{ticks:{color:"#facc15"}}}}
  });

  new Chart(sourceChart, {
    type:"pie",
    data:{ labels:Object.keys(sourceCounts), datasets:[{ data:Object.values(sourceCounts), backgroundColor:["#facc15","#d4aa00","#aa8800"]}]}
  });

  const timelineKeys = Object.keys(timelineCounts).sort();
  new Chart(timelineChart,{
    type:"line",
    data:{ labels:timelineKeys, datasets:[{ data:timelineKeys.map(k=>timelineCounts[k]), borderColor:"#facc15", fill:false }]}
  });
})();
