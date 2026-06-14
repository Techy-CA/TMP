let allTasks = [];
let allUsers = [];
let statusChart = null;
let trendChart = null;
let reportInitialized = false;

(function () {
  const wait = setInterval(() => {
    if (window.auth && window.db && window.Chart) {
      clearInterval(wait);
      boot();
    }
  }, 50);

  setTimeout(() => clearInterval(wait), 5000);

  function boot() {
    if (reportInitialized) return;
    reportInitialized = true;

    bindUI();
    auth.onAuthStateChanged(async user => {
      const loading = document.getElementById("loadingScreen");
      const denied = document.getElementById("accessDenied");
      const page = document.getElementById("reportPage");

      if (!user) {
  if (loading) loading.style.display = "none";
  if (denied) denied.style.display = "block";
  if (page) page.style.display = "none";
  return;
}

      try {
        const snap = await db.collection("users").doc(user.uid).get();
        const data = snap.exists ? snap.data() : {};
        const role = data.role || "member";

        if (loading) loading.style.display = "none";

        if (role !== "admin") {
          if (denied) denied.style.display = "block";
          if (page) page.style.display = "none";
          return;
        }

        if (page) page.style.display = "block";
        await loadAll();
      } catch (e) {
        console.error(e);
        if (loading) loading.style.display = "none";
        toast("Failed to load reports");
      }
    });
  }

  function bindUI() {
    const fUser = document.getElementById("filterUser");
    const fPeriod = document.getElementById("filterPeriod");
    const exportBtn = document.getElementById("exportBtn");

    if (fUser) fUser.onchange = render;
    if (fPeriod) fPeriod.onchange = render;
    if (exportBtn) exportBtn.onclick = exportCSV;

    window.applyFilters = render;
    window.exportCSV = exportCSV;
  }

  async function loadAll() {
    const [usersSnap, tasksSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("tasks").orderBy("createdAt", "desc").get()
    ]);

    allUsers = [];
    usersSnap.forEach(doc => {
      const u = doc.data();
      if (u.disabled !== true) allUsers.push({ id: doc.id, ...u });
    });

    allTasks = [];
    tasksSnap.forEach(doc => allTasks.push({ id: doc.id, ...doc.data() }));

    populateFilters();
    render();
  }

  function populateFilters() {
    const sel = document.getElementById("filterUser");
    if (!sel) return;

    sel.innerHTML = '<option value="all">All Team Members</option>';

    allUsers
      .filter(u => u.role !== "admin")
      .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
      .forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.fullName || u.email || "Unnamed";
        sel.appendChild(opt);
      });
  }

  function getFilteredTasks() {
    const user = document.getElementById("filterUser")?.value || "all";
    const period = document.getElementById("filterPeriod")?.value || "month";
    const now = Date.now();
    const DAY = 86400000;

    return allTasks.filter(t => {
      if (user !== "all" && t.assignedToUid !== user) return false;

      if (period !== "all") {
        const days = period === "week" ? 7 : 30;
        const created = tsToMs(t.createdAt);
        if (!created || now - created > days * DAY) return false;
      }

      return true;
    });
  }

  function render() {
    const tasks = getFilteredTasks();
    const selectedUser = document.getElementById("filterUser")?.value || "all";

    const total = tasks.length;
    const done = tasks.filter(t => normalizeStatus(t.status) === "done").length;
    const progress = tasks.filter(t => normalizeStatus(t.status) === "in-progress").length;
    const todo = tasks.filter(t => {
      const s = normalizeStatus(t.status);
      return s === "todo" || s === "pending" || s === "";
    }).length;

    setText("stTotal", total);
    setText("stDone", done);
    setText("stProgress", progress);
    setText("stPending", todo);

    setText("stTotalSub", "");
    setText("stDoneSub", total ? `${pct(done, total)}% of total` : "");
    setText("stProgressSub", total ? `${pct(progress, total)}% of total` : "");
    setText("stPendingSub", total ? `${pct(todo, total)}% of total` : "");

    renderStatusChart(done, progress, todo);
    renderTrendChart(tasks);
    renderPriorityBars(tasks);
    renderLeaderboard(tasks);
    renderDetailTable(tasks, selectedUser);
  }

  function renderStatusChart(done, progress, todo) {
    const canvas = document.getElementById("statusChart");
    const empty = document.getElementById("statusEmpty");
    if (!canvas) return;

    if (statusChart) statusChart.destroy();

    if (done + progress + todo === 0) {
      canvas.style.display = "none";
      if (empty) empty.style.display = "flex";
      return;
    }

    canvas.style.display = "block";
    if (empty) empty.style.display = "none";

    statusChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Done", "In Progress", "To Do"],
        datasets: [{
          data: [done, progress, todo],
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b"],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw}`
            }
          }
        }
      }
    });
  }

  function renderTrendChart(tasks) {
    const canvas = document.getElementById("trendChart");
    if (!canvas) return;

    const labels = [];
    const values = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

      const count = tasks.filter(t => {
        const created = toDateObj(t.createdAt);
        return created && created.toISOString().slice(0, 10) === key;
      }).length;

      labels.push(label);
      values.push(count);
    }

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Tasks",
          data: values,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,.12)",
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: "#3b82f6"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8" } },
          y: { beginAtZero: true, grid: { color: "#f1f5f9" }, ticks: { stepSize: 1, color: "#94a3b8" } }
        }
      }
    });
  }

  function renderPriorityBars(tasks) {
    const wrap = document.getElementById("priorityBars");
    if (!wrap) return;

    const total = tasks.length || 1;
    const high = tasks.filter(t => normalizePriority(t.priority) === "high").length;
    const medium = tasks.filter(t => normalizePriority(t.priority) === "medium").length;
    const low = tasks.filter(t => normalizePriority(t.priority) === "low" || !t.priority).length;

    const bars = [
      { label: "High", count: high, color: "#ef4444" },
      { label: "Medium", count: medium, color: "#f59e0b" },
      { label: "Low", count: low, color: "#10b981" }
    ];

    wrap.innerHTML = bars.map(b => `
      <div class="p-bar-row">
        <div class="p-bar-meta">
          <span class="lbl">${b.label}</span>
          <span class="cnt">${b.count} task${b.count !== 1 ? "s" : ""} · ${pct(b.count, total)}%</span>
        </div>
        <div class="p-bar-track">
          <div class="p-bar-fill" style="width:${pct(b.count, total)}%; background:${b.color}"></div>
        </div>
      </div>
    `).join("");
  }

  function renderLeaderboard(tasks) {
    const tbody = document.getElementById("leaderboardBody");
    const empty = document.getElementById("leaderboardEmpty");
    const badge = document.getElementById("memberCountBadge");
    if (!tbody) return;

    const statsMap = {};
    allUsers.forEach(u => {
      statsMap[u.id] = {
        name: u.fullName || u.email || "Unnamed",
        assigned: 0,
        done: 0,
        progress: 0,
        pending: 0
      };
    });

    tasks.forEach(t => {
      const uid = t.assignedToUid;
      if (!uid) return;

      if (!statsMap[uid]) {
        statsMap[uid] = {
          name: t.assignedToName || "Unknown",
          assigned: 0,
          done: 0,
          progress: 0,
          pending: 0
        };
      }

      statsMap[uid].assigned++;
      const s = normalizeStatus(t.status);
      if (s === "done") statsMap[uid].done++;
      else if (s === "in-progress") statsMap[uid].progress++;
      else statsMap[uid].pending++;
    });

    const rows = Object.values(statsMap)
      .filter(s => s.assigned > 0)
      .sort((a, b) => b.done - a.done || b.assigned - a.assigned);

    if (badge) badge.textContent = `${rows.length} member${rows.length !== 1 ? "s" : ""}`;

    if (!rows.length) {
      tbody.innerHTML = "";
      if (empty) empty.style.display = "flex";
      return;
    }

    if (empty) empty.style.display = "none";
    const medals = ["🥇", "🥈", "🥉"];

    tbody.innerHTML = rows.map((s, i) => {
      const rate = s.assigned ? Math.round((s.done / s.assigned) * 100) : 0;
      const rateClass = rate >= 75 ? "badge-green" : rate >= 40 ? "badge-amber" : "badge-red";
      return `
        <tr>
          <td>
            <div class="rank-cell">
              ${i < 3 ? `<span class="medal">${medals[i]}</span>` : ""}
              <span style="font-size:13px;font-weight:600;color:var(--text-3)">#${i + 1}</span>
            </div>
          </td>
          <td style="font-weight:600;color:var(--text-1)">${safe(s.name)}</td>
          <td class="c" style="font-weight:600">${s.assigned}</td>
          <td class="c"><span class="badge badge-green">${s.done}</span></td>
          <td class="c"><span class="badge badge-blue">${s.progress}</span></td>
          <td class="c"><span class="badge badge-amber">${s.pending}</span></td>
          <td class="c"><span class="badge ${rateClass}">${rate}%</span></td>
        </tr>
      `;
    }).join("");
  }

  function renderDetailTable(tasks) {
    const section = document.getElementById("detailSection");
    const tbody = document.getElementById("detailBody");
    const empty = document.getElementById("detailEmpty");
    const badge = document.getElementById("detailCountBadge");
    if (!section || !tbody) return;

    section.style.display = "block";
    if (badge) badge.textContent = `${tasks.length} task${tasks.length !== 1 ? "s" : ""}`;

    if (!tasks.length) {
      tbody.innerHTML = "";
      if (empty) empty.style.display = "flex";
      return;
    }

    if (empty) empty.style.display = "none";

    tbody.innerHTML = tasks.map(t => `
      <tr>
        <td style="max-width:260px">
          <div style="font-weight:500;color:var(--text-1)">${safe(t.title || "Untitled")}</div>
          ${t.description ? `<div style="font-size:11px;color:var(--text-4);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px">${safe(t.description)}</div>` : ""}
        </td>
        <td class="c">${statusBadge(normalizeStatus(t.status))}</td>
        <td class="c">${priorityBadge(normalizePriority(t.priority))}</td>
        <td class="c" style="font-size:12px;white-space:nowrap">${t.dueDate ? safe(t.dueDate) : fmtDate(t.createdAt)}</td>
        <td class="c" style="font-size:12px">${safe(t.assignedToName || "—")}</td>
      </tr>
    `).join("");
  }

  function exportCSV() {
    const tasks = getFilteredTasks();
    if (!tasks.length) return toast("No data to export");

    const header = ["Title", "Description", "Status", "Priority", "Assigned To", "Due Date", "Created At"];
    const rows = tasks.map(t => [
      csvCell(t.title),
      csvCell(t.description),
      csvCell(normalizeStatus(t.status)),
      csvCell(normalizePriority(t.priority)),
      csvCell(t.assignedToName),
      csvCell(t.dueDate || ""),
      csvCell(fmtDate(t.createdAt))
    ].join(","));

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exported");
  }

  function normalizeStatus(v) {
    return String(v ?? "").toLowerCase().trim();
  }

  function normalizePriority(v) {
    return String(v ?? "").toLowerCase().trim();
  }

  function toDateObj(ts) {
    if (!ts) return null;
    if (ts.toDate) return ts.toDate();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  function tsToMs(ts) {
    const d = toDateObj(ts);
    return d ? d.getTime() : 0;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function pct(n, total) {
    return total > 0 ? Math.round((n / total) * 100) : 0;
  }

  function safe(str) {
    return String(str ?? "").replace(/[&<>"']/g, s => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[s]));
  }

  function csvCell(v) {
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }

  function fmtDate(ts) {
    const d = toDateObj(ts);
    if (!d) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function statusBadge(s) {
    if (s === "done") return '<span class="badge badge-green">Done</span>';
    if (s === "in-progress") return '<span class="badge badge-blue">In Progress</span>';
    return '<span class="badge badge-amber">To Do</span>';
  }

  function priorityBadge(p) {
    if (p === "high") return '<span class="badge badge-red">High</span>';
    if (p === "medium") return '<span class="badge badge-amber">Medium</span>';
    return '<span class="badge badge-green">Low</span>';
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.add("show");
    clearTimeout(window._tt);
    window._tt = setTimeout(() => {
      el.classList.remove("show");
      el.classList.add("hidden");
    }, 2200);
  }
})();