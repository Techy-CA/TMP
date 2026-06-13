let unsubscribeTasks = null;
let unsubscribeUsers = null;
let unsubscribeNotifs = null;
let unsubscribeAttendance = null;
let unsubscribeLeaves = null;

window.unsubscribeTasks = null;
window.unsubscribeUsers = null;
window.unsubscribeNotifs = null;

function safe(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}

function v(id) {
  return document.getElementById(id)?.value?.trim() ?? "";
}

function initial(str) {
  return (str || "U")[0].toUpperCase();
}

function emptyState(msg) {
  return `
    <div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
      <p>${safe(msg)}</p>
    </div>
  `;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span>${safe(msg)}</span>
    </div>`;
  el.classList.remove("hidden");
  clearTimeout(window.tt);
  window.tt = setTimeout(() => el.classList.add("hidden"), 3200);
}

function openUpdateModal(title, message) {
  const t = document.getElementById("updateModalTitle");
  const d = document.getElementById("updateModalDesc");
  const b = document.getElementById("updateModalBody");
  const m = document.getElementById("updateModal");
  if (!t || !d || !b || !m) return;
  t.textContent = title || "Update";
  d.textContent = "New activity in your workspace.";
  b.innerHTML = `<p style="color:var(--text-2);font-size:14px;line-height:1.7">${safe(message)}</p>`;
  m.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeUpdateModal() {
  document.getElementById("updateModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

function closeMemberModal() {
  document.getElementById("memberModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

function closeEditModal() {
  document.getElementById("editTaskModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

function closeDeleteModal() {
  document.getElementById("deleteModal")?.classList.add("hidden");
  document.body.style.overflow = "";
}

async function hasAdminClaim() {
  const user = auth.currentUser;
  if (!user) return false;
  const res = await user.getIdTokenResult(true);
  return !!(res.claims.admin || res.claims.role === "admin");
}

function showScreen(name) {
  const authEl = document.getElementById("authScreen");
  const appEl = document.getElementById("appScreen");
  if (!authEl || !appEl) return;
  if (name === "auth") {
    authEl.classList.remove("hidden");
    appEl.classList.add("hidden");
  } else {
    authEl.classList.add("hidden");
    appEl.classList.remove("hidden");
  }
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeStr(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function datePretty(yyyyMMdd) {
  if (!yyyyMMdd) return "—";
  const d = new Date(`${yyyyMMdd}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function switchView(name, statusFilter) {
  document.querySelectorAll(".view").forEach(vw => {
    vw.classList.remove("active-view");
    vw.classList.add("hidden");
  });

  const el = document.getElementById(`view-${name}`);
  if (el) {
    el.classList.remove("hidden");
    el.classList.add("active-view");
  }

  document.querySelectorAll(".sb-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));

  const meta = {
    dashboard: ["Dashboard", "Live overview of tasks and team activity"],
    tasks: ["Tasks", "All tasks across the portal"],
    admin: ["Team Members", "Manage users, assignments and leave"],
    attendance: ["Attendance & Payroll", "Daily punch in/out, recent attendance and leave requests"],
    "attendance-admin": ["Attendance Admin", "All attendance records and leave approvals"],
    clients: ["Clients", "Client management"],
    mytasks: ["My Tasks", "Tasks assigned to you"],
    profile: ["Profile & Settings", "Update your personal details"],
    reports: ["Reports", "Team analytics and performance overview"]
  };

  const pt = document.getElementById("pageTitle");
  const ps = document.getElementById("pageSub");
  if (pt) pt.textContent = meta[name]?.[0] ?? name;
  if (ps) ps.textContent = meta[name]?.[1] ?? "";

  closeSidebar();

  if (name === "tasks" && statusFilter !== undefined) {
    const filterEl = document.getElementById("filterStatus");
    if (filterEl) filterEl.value = statusFilter;
    renderAllTasks();
  }

  if (name === "attendance") {
    loadAttendanceSection();
    renderAttendanceHistory();
    renderMyLeaves();
  }
  if (name === "attendance-admin") {
    renderAdminAttendance();
    renderAdminLeaves();
  }
  if (name === "reports") {
    if (typeof loadReportData === "function") loadReportData();
  }
}

function openTasksWithFilter(filter) {
  switchView("tasks", filter ?? undefined);
}

function makeStatsClickable() {
  const map = [
    ["stTotal", null],
    ["stTodo", "todo"],
    ["stProgress", "in-progress"],
    ["stDone", "done"]
  ];
  map.forEach(([id, filter]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cursor = "pointer";
    el.title = filter ? `Show ${filter} tasks` : "Show all tasks";
    el.onclick = () => switchView("tasks", filter ?? undefined);
  });
}

async function notify(userId, title, message, type = "info") {
  await db.collection("notifications").add({
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function renderTask(doc, role, uid) {
  const t = doc.data();
  const canEdit = role === "admin" || t.createdBy === uid || t.assignedToUid === uid;
  const createdStr = formatDate(t.createdAt);
  const updatedStr = t.updatedAt && t.createdAt && t.updatedAt.seconds !== t.createdAt.seconds ? formatDate(t.updatedAt) : null;

  const div = document.createElement("div");
  div.className = "task-item";
  div.innerHTML = `
    <div class="task-dot dot-${(t.status || "todo").replace(" ", "-")}"></div>
    <div class="task-body">
      <h4>${safe(t.title || "Untitled")}</h4>
      <p>${safe(t.description || "")}</p>
      <div class="task-meta-row">
        <span class="badge badge-${t.status || "todo"}">${safe(t.status || "todo")}</span>
        ${t.priority ? `<span class="badge badge-${t.priority}">${safe(t.priority)}</span>` : ""}
        ${t.dueDate ? `<span class="badge badge-due">Due ${safe(t.dueDate)}</span>` : ""}
        <small style="color:var(--text-4)">${safe(t.assignedToName || "")}</small>
      </div>
      <div class="task-timestamps">
        <span>Added ${createdStr}</span>
        ${updatedStr ? `<span>Updated ${updatedStr}</span>` : ""}
        ${t.createdByName ? `<span>By ${safe(t.createdByName)}</span>` : ""}
      </div>
    </div>
    <div class="task-actions">
      ${canEdit ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="editTask('${doc.id}')">Edit</button>` : ""}
      ${canEdit ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px;color:#dc2626" onclick="deleteTask('${doc.id}','${safe(t.title || "Untitled")}')">Delete</button>` : ""}
      ${role !== "admin" && t.assignedToUid === uid && t.status !== "done" ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="setStatus('${doc.id}','done','${uid}')">Mark Done</button>` : ""}
    </div>
  `;
  return div;
}

function memberDetailsHTML(u) {
  return `
    <div class="info-rows">
      <div class="info-row"><span class="ir-label">Full Name</span><span class="ir-val">${safe(u.fullName || "")}</span></div>
      <div class="info-row"><span class="ir-label">Email</span><span class="ir-val">${safe(u.email || "")}</span></div>
      <div class="info-row"><span class="ir-label">Role</span><span class="ir-val">${safe(u.role || "member")}</span></div>
      <div class="info-row"><span class="ir-label">Phone</span><span class="ir-val">${safe(u.phone || "")}</span></div>
      <div class="info-row"><span class="ir-label">Date of Birth</span><span class="ir-val">${safe(u.dob || "")}</span></div>
      <div class="info-row"><span class="ir-label">Age</span><span class="ir-val">${safe(u.age || "")}</span></div>
      <div class="info-row"><span class="ir-label">Aadhaar</span><span class="ir-val">${safe(u.aadhaar || "")}</span></div>
      <div class="info-row"><span class="ir-label">PAN</span><span class="ir-val">${safe(u.pan || "")}</span></div>
      <div class="info-row"><span class="ir-label">City</span><span class="ir-val">${safe(u.city || "")}</span></div>
      <div class="info-row"><span class="ir-label">State</span><span class="ir-val">${safe(u.state || "")}</span></div>
      <div class="info-row"><span class="ir-label">PIN Code</span><span class="ir-val">${safe(u.pinCode || "")}</span></div>
      <div class="info-row"><span class="ir-label">Address</span><span class="ir-val">${safe(u.fullAddress || "")}</span></div>
    </div>
  `;
}

function openMemberModal(u) {
  const m = document.getElementById("memberModal");
  const t = document.getElementById("memberModalTitle");
  const b = document.getElementById("memberModalBody");
  if (!m || !t || !b) return;
  t.textContent = u.fullName || u.email || "Member Details";
  b.innerHTML = memberDetailsHTML(u);
  m.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

async function loadAttendanceSection() {
  const uid = window._user?.uid;
  if (!uid) return;

  const snap = await db.collection("attendance")
    .where("userId", "==", uid)
    .where("dateKey", "==", todayKey())
    .limit(1)
    .get();

  const data = snap.empty ? null : snap.docs[0].data();

  document.getElementById("attTodayStatus").textContent = data ? (data.punchOutAt ? "Completed" : "Working") : "Not marked";
  document.getElementById("attPunchIn").textContent = data?.punchInAt ? timeStr(data.punchInAt) : "—";
  document.getElementById("attPunchOut").textContent = data?.punchOutAt ? timeStr(data.punchOutAt) : "—";
  document.getElementById("punchInBtn").disabled = !!data;
  document.getElementById("punchOutBtn").disabled = !data || !!data.punchOutAt;
}

async function renderAttendanceHistory() {
  const uid = window._user?.uid;
  const list = document.getElementById("attendanceHistory");
  if (!uid || !list) return;

  list.innerHTML = `<div class="mini-loading">Loading attendance...</div>`;

  try {
    const snap = await db.collection("attendance")
      .where("userId", "==", uid)
      .get();

    if (snap.empty) {
      list.innerHTML = emptyState("No attendance records yet.");
      return;
    }

    const byDay = new Map();
    snap.forEach(doc => {
      const a = doc.data();
      const key = a.dateKey || todayKey();
      const existing = byDay.get(key);
      if (!existing) {
        byDay.set(key, { id: doc.id, ...a });
        return;
      }
      const getMs = ts => ts?.toDate ? ts.toDate().getTime() : (ts ? new Date(ts).getTime() : 0);
      const currMs = getMs(a.punchInAt) || getMs(a.updatedAt) || 0;
      const prevMs = getMs(existing.punchInAt) || getMs(existing.updatedAt) || 0;
      if (currMs >= prevMs) byDay.set(key, { id: doc.id, ...a });
    });

    const records = [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 15)
      .map(([, val]) => val);

    list.innerHTML = "";
    records.forEach(a => {
      const card = document.createElement("div");
      card.className = "task-item";
      card.innerHTML = `
        <div class="task-body">
          <h4>${safe(datePretty(a.dateKey))}</h4>
          <p>Punch In: ${a.punchInAt ? timeStr(a.punchInAt) : "—"} &nbsp;|&nbsp; Punch Out: ${a.punchOutAt ? timeStr(a.punchOutAt) : "—"}</p>
          <div class="task-meta-row">
            <span class="badge ${a.punchOutAt ? "badge-done" : "badge-in-progress"}">${a.punchOutAt ? "Completed" : "Working"}</span>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    console.error("renderAttendanceHistory:", err);
    list.innerHTML = emptyState("Failed to load attendance.");
  }
}

async function punchIn() {
  const user = window._user;
  if (!user) return;

  const dateKey = todayKey();
  const snap = await db.collection("attendance")
    .where("userId", "==", user.uid)
    .where("dateKey", "==", dateKey)
    .limit(1)
    .get();

  if (!snap.empty) {
    showToast("Already punched in today");
    await loadAttendanceSection();
    await renderAttendanceHistory();
    return;
  }

  await db.collection("attendance").add({
    userId: user.uid,
    userName: window._userData?.fullName || user.email || "User",
    dateKey,
    punchInAt: firebase.firestore.FieldValue.serverTimestamp(),
    punchOutAt: null,
    status: "present",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  showToast("Punch in successful");
  await loadAttendanceSection();
  await renderAttendanceHistory();
}

async function punchOut() {
  const user = window._user;
  if (!user) return;

  const dateKey = todayKey();
  const snap = await db.collection("attendance")
    .where("userId", "==", user.uid)
    .where("dateKey", "==", dateKey)
    .limit(1)
    .get();

  if (snap.empty) return showToast("Punch in first");

  const doc = snap.docs[0];
  const data = doc.data();

  if (data.punchOutAt) {
    showToast("Already punched out today");
    await loadAttendanceSection();
    await renderAttendanceHistory();
    return;
  }

  await doc.ref.update({
    punchOutAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  showToast("Punch out successful");
  await loadAttendanceSection();
  await renderAttendanceHistory();
}

async function submitLeaveRequest(e) {
  e.preventDefault();
  const user = window._user;
  if (!user) return;

  const fromDate = document.getElementById("leaveFromDate").value;
  const toDate = document.getElementById("leaveToDate").value;
  const reason = document.getElementById("leaveReason").value.trim();

  if (!fromDate || !toDate || !reason) return showToast("Fill all leave fields");
  if (fromDate > toDate) return showToast("From date must be before to date");

  await db.collection("leaveRequests").add({
    userId: user.uid,
    userName: window._userData?.fullName || user.email || "User",
    fromDate,
    toDate,
    reason,
    status: "pending",
    adminNote: "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  e.target.reset();
  showToast("Leave request submitted");
  await renderMyLeaves();
}

async function renderMyLeaves() {
  const uid = window._user?.uid;
  const list = document.getElementById("myLeaveList");
  if (!uid || !list) return;

  list.innerHTML = `<div class="mini-loading">Loading leave requests...</div>`;

  const snap = await db.collection("leaveRequests")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  if (snap.empty) {
    list.innerHTML = emptyState("No leave requests yet.");
    return;
  }

  list.innerHTML = "";
  snap.forEach(doc => {
    const l = doc.data();
    const card = document.createElement("div");
    card.className = "task-item";
    card.innerHTML = `
      <div class="task-body">
        <h4>${safe(datePretty(l.fromDate))} &rarr; ${safe(datePretty(l.toDate))}</h4>
        <p>${safe(l.reason || "")}</p>
        <div class="task-meta-row">
          <span class="badge ${l.status === "approved" ? "badge-done" : l.status === "rejected" ? "badge-low" : "badge-in-progress"}">${safe(l.status || "pending")}</span>
          ${l.adminNote ? `<small style="color:var(--text-4)">Note: ${safe(l.adminNote)}</small>` : ""}
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

async function renderAdminAttendance() {
  const list = document.getElementById("adminAttendanceList");
  if (!list) return;

  const isAdmin = await hasAdminClaim();
  if (!isAdmin) {
    list.innerHTML = emptyState("Admin access required.");
    return;
  }

  list.innerHTML = `<div class="mini-loading">Loading attendance...</div>`;

  const snap = await db.collection("attendance")
    .orderBy("dateKey", "desc")
    .limit(30)
    .get();

  const total = snap.size;
  let presentToday = 0;
  const today = todayKey();

  snap.forEach(doc => {
    const a = doc.data();
    if (a.dateKey === today && a.punchInAt && !a.punchOutAt) presentToday++;
  });

  const adminTotalEl = document.getElementById("adminAttTotal");
  const adminPresentEl = document.getElementById("adminAttPresent");
  if (adminTotalEl) adminTotalEl.textContent = total;
  if (adminPresentEl) adminPresentEl.textContent = presentToday;

  if (snap.empty) {
    list.innerHTML = emptyState("No attendance records found.");
    return;
  }

  list.innerHTML = "";
  snap.forEach(doc => {
    const a = doc.data();
    const row = document.createElement("div");
    row.className = "task-item";
    row.innerHTML = `
      <div class="task-body">
        <h4>${safe(a.userName || "User")}</h4>
        <p>${safe(datePretty(a.dateKey))}</p>
        <div class="task-meta-row">
          <span class="badge ${a.punchOutAt ? "badge-done" : "badge-in-progress"}">${a.punchOutAt ? "Completed" : "Working"}</span>
          <small style="color:var(--text-4)">In: ${a.punchInAt ? timeStr(a.punchInAt) : "—"} | Out: ${a.punchOutAt ? timeStr(a.punchOutAt) : "—"}</small>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

async function renderAdminLeaves() {
  const list = document.getElementById("leaveAdminList");
  if (!list) return;

  const isAdmin = await hasAdminClaim();
  if (!isAdmin) {
    list.innerHTML = emptyState("Admin access required.");
    return;
  }

  list.innerHTML = `<div class="mini-loading">Loading leave requests...</div>`;

  const snap = await db.collection("leaveRequests")
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();

  const adminLeaveTotalEl = document.getElementById("adminLeaveTotal");
  if (adminLeaveTotalEl) adminLeaveTotalEl.textContent = snap.size;

  if (snap.empty) {
    list.innerHTML = emptyState("No leave requests.");
    return;
  }

  list.innerHTML = "";
  snap.forEach(doc => {
    const l = doc.data();
    const row = document.createElement("div");
    row.className = "task-item";
    row.innerHTML = `
      <div class="task-body">
        <h4>${safe(l.userName || "User")}</h4>
        <p>${safe(datePretty(l.fromDate))} &rarr; ${safe(datePretty(l.toDate))}</p>
        <p>${safe(l.reason || "")}</p>
        ${l.adminNote ? `<small style="color:var(--text-4)">Note: ${safe(l.adminNote)}</small>` : ""}
        <div class="task-meta-row">
          <span class="badge ${l.status === "approved" ? "badge-done" : l.status === "rejected" ? "badge-low" : "badge-in-progress"}">${safe(l.status || "pending")}</span>
        </div>
      </div>
      <div class="task-actions">
        ${l.status === "pending" ? `<button class="btn-primary" onclick="approveLeave('${doc.id}')">Approve</button>` : ""}
        ${l.status === "pending" ? `<button class="btn-ghost" onclick="rejectLeave('${doc.id}')">Reject</button>` : ""}
      </div>
    `;
    list.appendChild(row);
  });
}

window.approveLeave = async function(id) {
  const note = prompt("Approval note (optional):") || "";
  await db.collection("leaveRequests").doc(id).update({
    status: "approved",
    adminNote: note,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast("Leave approved");
  await renderAdminLeaves();
};

window.rejectLeave = async function(id) {
  const note = prompt("Reject reason (optional):") || "";
  await db.collection("leaveRequests").doc(id).update({
    status: "rejected",
    adminNote: note,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast("Leave rejected");
  await renderAdminLeaves();
};

function setupAttendanceModule() {
  document.getElementById("punchInBtn")?.addEventListener("click", punchIn);
  document.getElementById("punchOutBtn")?.addEventListener("click", punchOut);
  document.getElementById("leaveForm")?.addEventListener("submit", submitLeaveRequest);

  document.getElementById("refreshAttendanceBtn")?.addEventListener("click", async () => {
    await loadAttendanceSection();
    await renderAttendanceHistory();
    await renderMyLeaves();
  });

  document.getElementById("refreshAdminAttendanceBtn")?.addEventListener("click", async () => {
    await renderAdminAttendance();
    await renderAdminLeaves();
  });
}

async function loadDashboard() {
  const snap = await db.collection("tasks").orderBy("createdAt", "desc").limit(20).get();
  const tasks = [];
  snap.forEach(d => tasks.push({ id: d.id, ...d.data() }));

  document.getElementById("stTotal").textContent = tasks.length;
  document.getElementById("stTodo").textContent = tasks.filter(t => t.status === "todo").length;
  document.getElementById("stProgress").textContent = tasks.filter(t => t.status === "in-progress").length;
  document.getElementById("stDone").textContent = tasks.filter(t => t.status === "done").length;

  const dashTaskList = document.getElementById("dashTaskList");
  if (dashTaskList) {
    dashTaskList.innerHTML = tasks.slice(0, 5).map(t => `
      <div class="task-item">
        <div class="task-body">
          <h4>${safe(t.title || "Untitled")}</h4>
          <p>${safe(t.description || "")}</p>
          <div class="task-meta-row">
            <span class="badge badge-${t.status || "todo"}">${safe(t.status || "todo")}</span>
            ${t.priority ? `<span class="badge badge-${t.priority}">${safe(t.priority)}</span>` : ""}
            ${t.assignedToName ? `<small style="color:var(--text-4)">Assigned to ${safe(t.assignedToName)}</small>` : ""}
          </div>
        </div>
      </div>
    `).join("") || emptyState("No tasks yet.");
  }

  const dashTeamList = document.getElementById("dashTeamList");
  if (dashTeamList) {
    const usnap = await db.collection("users").orderBy("fullName").limit(6).get();
    const users = [];
    usnap.forEach(d => users.push({ id: d.id, ...d.data() }));
    dashTeamList.innerHTML = users.map(u => `
      <div class="member-row" style="cursor:pointer" onclick='openMemberModal(${JSON.stringify(u).replace(/"/g, "&quot;")})'>
        <div class="m-avatar">${initial(u.fullName || u.email)}</div>
        <div class="m-info">
          <strong>${safe(u.fullName || "Unnamed")}</strong>
          <small>${safe(u.email || "")}</small>
        </div>
        <span class="badge ${u.role === "admin" ? "badge-in-progress" : "badge-low"}">${safe(u.role || "member")}</span>
      </div>
    `).join("") || emptyState("No users found.");
  }
}

async function loadAssigneeFilter() {
  const sel = document.getElementById("filterAssignee");
  if (!sel) return;
  sel.innerHTML = '<option value="">All Team Members</option>';

  try {
    const snap = await db.collection("users").get();
    const users = [];
    snap.forEach(doc => {
      const u = doc.data() || {};
      if (u.disabled === true) return;
      users.push({ id: doc.id, ...u });
    });

    console.log("loadAssigneeFilter users:", users.length);

    users.sort((a, b) =>
      String(a.fullName || a.email || "").localeCompare(String(b.fullName || b.email || ""))
    );

    users.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.fullName || u.email || "Unnamed"} — ${u.email || ""}`;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("loadAssigneeFilter error:", err);
    sel.innerHTML = '<option value="">Failed to load team members</option>';
  }
}

// ─── FIX: renderAllTasks ────────────────────────────────────────────────────
// The Tasks view shows ALL tasks to everyone (same as admin).
// Role-based filtering is only applied in "My Tasks" (renderMemberTasks).
// When an assignee filter IS selected, we still filter by that selection.
async function renderAllTasks() {
  const list = document.getElementById("allTaskList");
  if (!list) return;

  const status   = document.getElementById("filterStatus")?.value   || "";
  const priority = document.getElementById("filterPriority")?.value || "";
  const assignee = document.getElementById("filterAssignee")?.value || "";
  const date     = document.getElementById("filterDate")?.value     || "";
  const search   = document.getElementById("searchInput")?.value?.trim().toLowerCase() || "";

  const snap = await db.collection("tasks").orderBy("createdAt", "desc").get();
  const items = [];

  snap.forEach((d) => {
    const t = { id: d.id, ...d.data() };

    // Filter by status
    if (status && t.status !== status) return;

    // Filter by priority
    if (priority && t.priority !== priority) return;

    // Filter by assignee (only when a specific assignee is selected)
    if (assignee && String(t.assignedToUid || "").trim() !== String(assignee).trim()) return;

    // Filter by creation date
    if (date) {
      const created = t.createdAt?.toDate ? t.createdAt.toDate() : (t.createdAt ? new Date(t.createdAt) : null);
      if (!created) return;
      if (created.toISOString().slice(0, 10) !== date) return;
    }

    // Search across title, description, assignee name
    if (search) {
      const hay = `${t.title || ""} ${t.description || ""} ${t.assignedToName || ""}`.toLowerCase();
      if (!hay.includes(search)) return;
    }

    items.push(t);
  });

  const role = window._userData?.role || "member";

  list.innerHTML = items.length
    ? items.map(t => `
      <div class="task-item">
        <div class="task-body">
          <h4>${safe(t.title || "Untitled")}</h4>
          <p>${safe(t.description || "")}</p>
          <div class="task-meta-row">
            <span class="badge badge-${t.status || "todo"}">${safe(t.status || "todo")}</span>
            ${t.priority ? `<span class="badge badge-${t.priority}">${safe(t.priority)}</span>` : ""}
            ${t.dueDate ? `<span class="badge badge-due">Due ${safe(t.dueDate)}</span>` : ""}
            <small style="color:var(--text-4)">Assigned to ${safe(t.assignedToName || "—")}</small>
          </div>
          <div class="task-timestamps">
            <span>Added ${formatDate(t.createdAt)}</span>
            ${t.updatedAt && t.createdAt && t.updatedAt.seconds !== t.createdAt.seconds ? `<span>Updated ${formatDate(t.updatedAt)}</span>` : ""}
            ${t.createdByName ? `<span>By ${safe(t.createdByName)}</span>` : ""}
          </div>
        </div>
        <div class="task-actions">
          ${role === "admin" ? `<button class="btn-ghost" onclick="editTask('${t.id}')">Edit</button>` : ""}
          ${role === "admin" ? `<button class="btn-ghost" style="color:#dc2626" onclick="deleteTask('${t.id}','${safe(t.title || "Untitled")}')">Delete</button>` : ""}
        </div>
      </div>
    `).join("")
    : emptyState("No tasks match your filters.");
}
// ───────────────────────────────────────────────────────────────────────────

function clearTaskFilters() {
  const elStatus   = document.getElementById("filterStatus");
  const elPriority = document.getElementById("filterPriority");
  const elAssignee = document.getElementById("filterAssignee");
  const elDate     = document.getElementById("filterDate");
  const elSearch   = document.getElementById("searchInput");

  if (elStatus)   elStatus.value   = "";
  if (elPriority) elPriority.value = "";
  if (elAssignee) elAssignee.value = "";
  if (elDate)     elDate.value     = "";
  if (elSearch)   elSearch.value   = "";

  renderAllTasks();
}

document.getElementById("clearFiltersBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  clearTaskFilters();
});

document.getElementById("filterStatus")?.addEventListener("change", renderAllTasks);
document.getElementById("filterPriority")?.addEventListener("change", renderAllTasks);
document.getElementById("filterAssignee")?.addEventListener("change", renderAllTasks);
document.getElementById("filterDate")?.addEventListener("change", renderAllTasks);
document.getElementById("searchInput")?.addEventListener("input", renderAllTasks);

async function loadAdminMembers() {
  const list = document.getElementById("adminMemberList");
  if (!list) return;

  const snap = await db.collection("users").orderBy("fullName").get();
  let count = 0;

  list.innerHTML = "";
  snap.forEach(doc => {
    const u = doc.data() || {};
    if (u.disabled === true) return;
    count++;

    const row = document.createElement("div");
    row.className = "member-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="m-avatar">${initial(u.fullName || u.email)}</div>
      <div class="m-info">
        <strong>${safe(u.fullName || "Unnamed")}</strong>
        <small>${safe(u.email || "")}</small>
      </div>
      <span class="badge ${u.role === "admin" ? "badge-in-progress" : "badge-low"}">${safe(u.role || "member")}</span>
      ${window._userData?.role === "admin" && doc.id !== window._user?.uid ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px;color:#dc2626" onclick="event.stopPropagation(); disableUser('${doc.id}','${safe(u.fullName || u.email || "User")}')">Remove</button>` : ""}
    `;
    row.addEventListener("click", () => openMemberModal({ id: doc.id, ...u }));
    list.appendChild(row);
  });

  document.getElementById("memberCount").textContent = count;
}

async function loadAssigneeDropdown() {
  const sel = document.getElementById("taskAssignee");
  if (!sel) return;
  sel.innerHTML = '<option value="">Select team member</option>';

  const snap = await db.collection("users").orderBy("fullName").get();
  snap.forEach(doc => {
    const u = doc.data() || {};
    if (u.disabled === true) return;
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${u.fullName || "Unnamed"} — ${u.email || ""}`;
    sel.appendChild(opt);
  });
}

async function renderMemberTasks(uid) {
  const list = document.getElementById("memberTaskList");
  if (!list) return;

  const snap = await db.collection("tasks").orderBy("createdAt", "desc").get();
  const items = [];
  snap.forEach(doc => {
    const t = doc.data();
    if (t.assignedToUid === uid) items.push({ id: doc.id, ...t });
  });

  list.innerHTML = items.length ? items.map(t => `
    <div class="task-item">
      <div class="task-dot dot-${(t.status || "todo").replace(" ", "-")}"></div>
      <div class="task-body">
        <h4>${safe(t.title || "Untitled")}</h4>
        <p>${safe(t.description || "")}</p>
        <div class="task-meta-row">
          <span class="badge badge-${t.status || "todo"}">${safe(t.status || "todo")}</span>
          ${t.priority ? `<span class="badge badge-${t.priority}">${safe(t.priority)}</span>` : ""}
          ${t.dueDate ? `<span class="badge badge-due">Due ${safe(t.dueDate)}</span>` : ""}
          <small style="color:var(--text-4)">Assigned to ${safe(t.assignedToName || "—")}</small>
        </div>
      </div>
      <div class="task-actions">
        ${t.status !== "done" ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="setStatus('${t.id}','in-progress','${uid}')">Start</button>` : ""}
        ${t.status !== "done" ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="setStatus('${t.id}','done','${uid}')">Mark Done</button>` : ""}
      </div>
    </div>
  `).join("") : emptyState("No tasks assigned to you.");
}

window.loadMemberTasks = renderMemberTasks;

window.setStatus = async function(taskId, status, uid) {
  const docSnap = await db.collection("tasks").doc(taskId).get();
  const t = docSnap.data() || {};
  await db.collection("tasks").doc(taskId).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await notify(uid, "Task updated", `${t.title || "Task"} marked as ${status}`, "success");
  showToast("Task marked as " + status);
  openUpdateModal("Task Updated", `Task has been marked as ${status}.`);
  await renderAllTasks();
  await renderMemberTasks(uid);
};

window.cycleAdminTask = async function(taskId, uid) {
  const docSnap = await db.collection("tasks").doc(taskId).get();
  const t = docSnap.data() || {};
  const next = t.status === "todo" ? "in-progress" : t.status === "in-progress" ? "done" : "todo";
  await db.collection("tasks").doc(taskId).update({
    status: next,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await notify(uid, "Task updated", `${t.title || "Task"} → ${next}`, "success");
  showToast("Status updated to " + next);
  openUpdateModal("Task Updated", `${t.title || "Task"} has been moved to ${next}.`);
};

window.editTask = async function(taskId) {
  const docSnap = await db.collection("tasks").doc(taskId).get();
  if (!docSnap.exists) return showToast("Task not found");
  const t = docSnap.data();

  document.getElementById("editTaskId").value = taskId;
  document.getElementById("editTitle").value = t.title || "";
  document.getElementById("editDesc").value = t.description || "";
  document.getElementById("editStatus").value = t.status || "todo";
  document.getElementById("editPriority").value = t.priority || "medium";
  document.getElementById("editDueDate").value = t.dueDate || "";
  document.getElementById("editTaskModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

window.deleteTask = function(taskId, taskTitle) {
  document.getElementById("deleteTaskId").value = taskId;
  document.getElementById("deleteTaskName").textContent = taskTitle || "this task";
  document.getElementById("deleteModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

window.disableUser = async function(userId, userName) {
  if (window._userData?.role !== "admin") return showToast("Only admin can remove users");
  if (userId === window._user?.uid) return showToast("You cannot remove yourself");
  if (!confirm(`Disable ${userName} from team?`)) return;

  try {
    await db.collection("users").doc(userId).set({ disabled: true }, { merge: true });
    showToast("User removed from team list");
    openUpdateModal("User Disabled", `${userName} access has been disabled.`);
  } catch (err) {
    console.error("disableUser error:", err);
    showToast(err.message || "Failed to disable user");
  }
};

function setupGlobalUI() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.add("open");
    document.getElementById("sidebarOverlay")?.classList.add("active");
  });
  document.getElementById("sidebarClose")?.addEventListener("click", closeSidebar);
  document.getElementById("sidebarOverlay")?.addEventListener("click", closeSidebar);

  document.getElementById("closeUpdateModal")?.addEventListener("click", closeUpdateModal);
  document.getElementById("dismissUpdateModal")?.addEventListener("click", closeUpdateModal);
  document.getElementById("goToTasksBtn")?.addEventListener("click", () => {
    closeUpdateModal();
    switchView("tasks");
  });
  document.getElementById("updateModal")?.addEventListener("click", e => {
    if (e.target.id === "updateModal") closeUpdateModal();
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (unsubscribeTasks) unsubscribeTasks();
    if (unsubscribeUsers) unsubscribeUsers();
    if (unsubscribeNotifs) unsubscribeNotifs();
    if (unsubscribeAttendance) unsubscribeAttendance();
    if (unsubscribeLeaves) unsubscribeLeaves();
    await auth.signOut();
    showScreen("auth");
  });

  document.getElementById("closeMemberModal")?.addEventListener("click", closeMemberModal);
  document.getElementById("closeMemberModal2")?.addEventListener("click", closeMemberModal);
  document.getElementById("memberModal")?.addEventListener("click", e => {
    if (e.target.id === "memberModal") closeMemberModal();
  });

  document.getElementById("btnNewTask")?.addEventListener("click", () => {
    document.getElementById("taskModal")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  });

  document.getElementById("closeTaskModal")?.addEventListener("click", () => {
    document.getElementById("taskModal")?.classList.add("hidden");
    document.body.style.overflow = "";
  });

  document.getElementById("taskModal")?.addEventListener("click", e => {
    if (e.target.id === "taskModal") {
      document.getElementById("taskModal")?.classList.add("hidden");
      document.body.style.overflow = "";
    }
  });

  document.getElementById("quickTaskForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const user = window._user;
    if (!user) return;

    const title = v("qtTitle");
    if (!title) return;

    await db.collection("tasks").add({
      title,
      description: v("qtDesc"),
      status: document.getElementById("qtStatus").value,
      priority: document.getElementById("qtPriority").value,
      assignedToUid: user.uid,
      assignedToName: window._userData?.fullName || user.email || "Me",
      dueDate: "",
      createdBy: user.uid,
      createdByName: window._userData?.fullName || user.email || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await notify(user.uid, "Task created", `${title} was created`, "success");
    document.getElementById("taskModal")?.classList.add("hidden");
    document.body.style.overflow = "";
    e.target.reset();
    showToast("Task created");
    openUpdateModal("Task Created", `${title} has been created successfully.`);
  });

  document.getElementById("editTaskForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const taskId = document.getElementById("editTaskId").value;
    const title = document.getElementById("editTitle").value.trim();
    const desc = document.getElementById("editDesc").value.trim();
    const status = document.getElementById("editStatus").value;
    const priority = document.getElementById("editPriority").value;
    const dueDate = document.getElementById("editDueDate").value;

    if (!title) return showToast("Title cannot be empty");

    await db.collection("tasks").doc(taskId).update({
      title,
      description: desc,
      status,
      priority,
      dueDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeEditModal();
    showToast("Task updated successfully");
    openUpdateModal("Task Updated", `${title} has been updated successfully.`);
  });

  document.getElementById("closeEditTaskModal")?.addEventListener("click", closeEditModal);
  document.getElementById("editTaskModal")?.addEventListener("click", e => {
    if (e.target.id === "editTaskModal") closeEditModal();
  });

  document.getElementById("closeDeleteModal")?.addEventListener("click", closeDeleteModal);
  document.getElementById("cancelDeleteBtn")?.addEventListener("click", e => {
    e.preventDefault();
    closeDeleteModal();
  });
  document.getElementById("deleteModal")?.addEventListener("click", e => {
    if (e.target.id === "deleteModal") closeDeleteModal();
  });

  document.getElementById("confirmDeleteBtn")?.addEventListener("click", async e => {
    e.preventDefault();
    const taskId = document.getElementById("deleteTaskId").value;
    const taskName = document.getElementById("deleteTaskName").textContent;
    if (!taskId) return;

    await db.collection("tasks").doc(taskId).delete();
    closeDeleteModal();
    showToast("Task deleted");
    openUpdateModal("Task Deleted", `${taskName} has been deleted.`);
  });

  document.getElementById("filterAssignee")?.addEventListener("change", renderAllTasks);
  document.getElementById("filterStatus")?.addEventListener("change", renderAllTasks);
  document.getElementById("filterPriority")?.addEventListener("change", renderAllTasks);
  document.getElementById("filterDate")?.addEventListener("change", renderAllTasks);
  document.getElementById("searchInput")?.addEventListener("input", renderAllTasks);

  document.getElementById("profileForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const user = window._user;
    if (!user) return;

    const updated = {
      fullName: v("pfFullName"),
      phone: v("pfPhone"),
      dob: v("pfDob"),
      age: Number(v("pfAge") || 0),
      aadhaar: v("pfAadhaar"),
      pan: v("pfPan"),
      city: v("pfCity"),
      state: v("pfState"),
      pinCode: v("pfPin"),
      fullAddress: v("pfAddress"),
      email: document.getElementById("pfEmail").value.trim()
    };

    await db.collection("users").doc(user.uid).set(updated, { merge: true });
    window._userData = { ...(window._userData || {}), ...updated };

    document.getElementById("sbName").textContent = updated.fullName || user.email;
    document.getElementById("sbAvatar").textContent = initial(updated.fullName || user.email);
    showToast("Profile saved");
    openUpdateModal("Profile Updated", "Your profile has been saved successfully.");
  });

  document.getElementById("leaveForm")?.addEventListener("submit", submitLeaveRequest);
}

async function setupRealtime() {
  const role = window._userData?.role || "member";
  const uid = window._user?.uid;
  if (!uid) return;

  if (unsubscribeTasks) unsubscribeTasks();
  if (unsubscribeUsers) unsubscribeUsers();
  if (unsubscribeNotifs) unsubscribeNotifs();
  if (unsubscribeAttendance) unsubscribeAttendance();
  if (unsubscribeLeaves) unsubscribeLeaves();

  unsubscribeTasks = db.collection("tasks")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      const dash = document.getElementById("dashTaskList");
      const all = document.getElementById("allTaskList");
      const my = document.getElementById("memberTaskList");
      if (dash) dash.innerHTML = "";
      if (all) all.innerHTML = "";
      if (my) my.innerHTML = "";

      let total = 0, todo = 0, prog = 0, done = 0;

      snap.forEach(doc => {
        const t = doc.data();
        total++;
        if (t.status === "todo") todo++;
        if (t.status === "in-progress") prog++;
        if (t.status === "done") done++;

        // Dashboard: show tasks relevant to the current user
        if (dash && (role === "admin" || t.assignedToUid === uid || t.createdBy === uid)) {
          dash.appendChild(renderTask(doc, role, uid));
        }

        // Tasks view: show ALL tasks regardless of role (filters handle narrowing)
        if (all) {
          all.appendChild(renderTask(doc, role, uid));
        }

        // My Tasks: only tasks assigned to this user
        if (my && t.assignedToUid === uid) {
          my.appendChild(renderTask(doc, role, uid));
        }
      });

      document.getElementById("stTotal").textContent = total;
      document.getElementById("stTodo").textContent = todo;
      document.getElementById("stProgress").textContent = prog;
      document.getElementById("stDone").textContent = done;

      const dash2 = document.getElementById("dashTaskList");
      const all2 = document.getElementById("allTaskList");
      const my2 = document.getElementById("memberTaskList");
      if (dash2 && !dash2.children.length) dash2.innerHTML = emptyState("No tasks yet.");
      if (all2 && !all2.children.length) all2.innerHTML = emptyState("No tasks found.");
      if (my2 && !my2.children.length) my2.innerHTML = emptyState("No tasks assigned to you.");

      makeStatsClickable();
    });

  unsubscribeUsers = db.collection("users").onSnapshot(async snap => {
    const adminList = document.getElementById("adminMemberList");
    const teamList = document.getElementById("dashTeamList");
    const memberCount = document.getElementById("memberCount");
    const taskAssignee = document.getElementById("taskAssignee");
    const filterAssignee = document.getElementById("filterAssignee");

    if (adminList) adminList.innerHTML = "";
    if (teamList) teamList.innerHTML = "";
    if (taskAssignee) taskAssignee.innerHTML = '<option value="">Select team member</option>';
    if (filterAssignee) filterAssignee.innerHTML = '<option value="">All Team Members</option>';

    let count = 0;
    const seen = new Set();

    snap.forEach(doc => {
      const u = doc.data() || {};
      if (u.disabled === true) return;

      const key = (doc.id + (u.email || "")).toLowerCase().trim();
      if (seen.has(key)) return;
      seen.add(key);
      count++;

      const canRemove = role === "admin" && doc.id !== uid;
      const label = `${u.fullName || "Unnamed"} — ${u.email || ""}`;

      if (adminList) {
        const row = document.createElement("div");
        row.className = "member-row";
        row.style.cursor = "pointer";
        row.innerHTML = `
          <div class="m-avatar">${initial(u.fullName || u.email)}</div>
          <div class="m-info">
            <strong>${safe(u.fullName || "Unnamed")}</strong>
            <small>${safe(u.email || "")}</small>
          </div>
          <span class="badge ${u.role === "admin" ? "badge-in-progress" : "badge-low"}">${safe(u.role || "member")}</span>
          ${canRemove ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px;color:#dc2626" onclick="event.stopPropagation();disableUser('${doc.id}','${safe(u.fullName || u.email || "User")}')">Remove</button>` : ""}
        `;
        row.addEventListener("click", () => openMemberModal({ id: doc.id, ...u }));
        adminList.appendChild(row);
      }

      if (teamList) {
        const row = document.createElement("div");
        row.className = "member-row";
        row.innerHTML = `
          <div class="m-avatar">${initial(u.fullName || u.email)}</div>
          <div class="m-info">
            <strong>${safe(u.fullName || "Unnamed")}</strong>
            <small>${safe(u.email || "")}</small>
          </div>
          <span class="badge ${u.role === "admin" ? "badge-in-progress" : "badge-low"}">${safe(u.role || "member")}</span>
        `;
        teamList.appendChild(row);
      }

      if (taskAssignee) {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = label;
        taskAssignee.appendChild(opt);
      }

      if (filterAssignee) {
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = label;
        filterAssignee.appendChild(opt);
      }
    });

    if (memberCount) memberCount.textContent = count;
    if (adminList && !adminList.children.length) adminList.innerHTML = emptyState("No team members found.");
    if (teamList && !teamList.children.length) teamList.innerHTML = emptyState("No team members found.");
  });

  let firstNotifLoad = true;
  unsubscribeNotifs = db.collection("notifications")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      if (firstNotifLoad) { firstNotifLoad = false; return; }
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const n = change.doc.data();
          showToast(`${n.title}: ${n.message}`);
        }
      });
    });

  unsubscribeAttendance = db.collection("attendance")
    .where("userId", "==", uid)
    .onSnapshot(async () => {
      await loadAttendanceSection();
      await renderAttendanceHistory();
    });

  unsubscribeLeaves = db.collection("leaveRequests")
    .where("userId", "==", uid)
    .onSnapshot(async () => {
      await renderMyLeaves();
    });
}

auth.onAuthStateChanged(async user => {
  if (!user) {
    showScreen("auth");
    return;
  }

  const docSnap = await db.collection("users").doc(user.uid).get();
  let data = docSnap.exists ? docSnap.data() : {};

  if (!docSnap.exists) {
    data = { fullName: user.displayName || "", email: user.email, role: "member" };
    await db.collection("users").doc(user.uid).set(data, { merge: true });
  }

  if (data.disabled === true) {
    await auth.signOut();
    showScreen("auth");
    showToast("Your account has been disabled.");
    return;
  }

  window._user = user;
  window._userData = data;

  const role = data.role || "member";
  document.body.classList.remove("role-admin", "role-member");
  document.body.classList.add(`role-${role}`);

  document.getElementById("sbAvatar").textContent = initial(data.fullName || user.email);
  document.getElementById("sbName").textContent = data.fullName || user.email || "User";
  document.getElementById("sbRole").textContent = role;

  const pfFields = {
    pfFullName: data.fullName, pfEmail: data.email || user.email,
    pfPhone: data.phone, pfDob: data.dob, pfAge: data.age,
    pfAadhaar: data.aadhaar, pfPan: data.pan,
    pfCity: data.city, pfState: data.state,
    pfPin: data.pinCode, pfAddress: data.fullAddress
  };
  Object.entries(pfFields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  });

  setupGlobalUI();
  setupAttendanceModule();
  await setupRealtime();
  await loadAttendanceSection();
  await renderAttendanceHistory();
  await renderMyLeaves();
  await renderAdminAttendance();
  await renderAdminLeaves();
  await loadAdminMembers();
  await loadAssigneeDropdown();
  await loadAssigneeFilter();

  showScreen("app");
  switchView("dashboard");
  showToast("Logged in successfully");
});

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTabBtn = document.getElementById("loginTabBtn");
const registerTabBtn = document.getElementById("registerTabBtn");

loginTabBtn?.addEventListener("click", () => {
  loginForm?.classList.add("active");
  registerForm?.classList.remove("active");
  loginTabBtn.classList.add("active");
  registerTabBtn.classList.remove("active");
});

registerTabBtn?.addEventListener("click", () => {
  registerForm?.classList.add("active");
  loginForm?.classList.remove("active");
  registerTabBtn.classList.add("active");
  loginTabBtn.classList.remove("active");
});

loginForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  if (errEl) errEl.textContent = "";
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
});

registerForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const role = document.getElementById("regRole").value;
  const errEl = document.getElementById("regError");
  if (errEl) errEl.textContent = "";
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(cred.user.uid).set({
      fullName: name, email, role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    if (errEl) errEl.textContent = err.message;
  }
});