/* ============================================================
   HELPERS
============================================================ */
function safe(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function v(id) { return document.getElementById(id)?.value.trim() ?? ""; }
function initial(str) { return (str || "U")[0].toUpperCase(); }

function emptyState(msg) {
  return `<div class="empty-state">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    <p>${msg}</p>
  </div>`;
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${safe(msg)}`;
  el.classList.remove("hidden");
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.classList.add("hidden"), 3500);
}

function showScreen(name) {
  const auth = document.getElementById("authScreen");
  const app  = document.getElementById("appScreen");
  if (name === "auth") { auth.classList.remove("hidden"); app.classList.add("hidden"); }
  else                 { auth.classList.add("hidden");    app.classList.remove("hidden"); }
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active-view");
    v.classList.add("hidden");
  });
  const el = document.getElementById(`view-${name}`);
  if (el) { el.classList.remove("hidden"); el.classList.add("active-view"); }

  document.querySelectorAll(".sb-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));

  const meta = {
    dashboard: ["Dashboard", "Here's your workspace overview"],
    tasks:     ["Tasks", "All tasks across your team"],
    admin:     ["Team Members", "Manage your team and assign work"],
    mytasks:   ["My Tasks", "Tasks assigned to you"],
    profile:   ["Profile & Settings", "Manage your account and details"]
  };
  document.getElementById("pageTitle").textContent = meta[name]?.[0] ?? name;
  document.getElementById("pageSub").textContent   = meta[name]?.[1] ?? "";

  closeSidebar();
}

/* ============================================================
   APP INIT
============================================================ */
function initApp(user, data) {
  const role = data.role || "member";

  document.body.classList.remove("role-admin","role-member");
  document.body.classList.add(`role-${role}`);

  document.getElementById("sbAvatar").textContent = initial(data.fullName || user.email);
  document.getElementById("sbName").textContent   = data.fullName || user.email || "User";
  document.getElementById("sbRole").textContent   = role;

  populateProfile(user, data);
  updateStats();
  loadDashboard();
  switchView("dashboard");

  if (role === "admin") {
    loadAssigneeDropdown();
    loadAdminMembers();
  }
}

/* ============================================================
   STATS
============================================================ */
async function updateStats() {
  const uid  = window._user?.uid;
  const role = window._userData?.role || "member";
  let snap;

  if (role === "admin") {
    snap = await db.collection("tasks").get();
  } else {
    snap = await db.collection("tasks").where("assignedToUid","==",uid).get();
  }

  let total=0, todo=0, prog=0, done=0;
  snap.forEach(doc => {
    const s = doc.data().status;
    total++;
    if (s === "todo") todo++;
    else if (s === "in-progress") prog++;
    else if (s === "done") done++;
  });

  document.getElementById("stTotal").textContent    = total;
  document.getElementById("stTodo").textContent     = todo;
  document.getElementById("stProgress").textContent = prog;
  document.getElementById("stDone").textContent     = done;
}

/* ============================================================
   DASHBOARD
============================================================ */
async function loadDashboard() {
  const taskList = document.getElementById("dashTaskList");
  const teamList = document.getElementById("dashTeamList");
  const role     = window._userData?.role || "member";
  const uid      = window._user?.uid;

  // recent tasks
  if (taskList) {
    taskList.innerHTML = "";
    let q = db.collection("tasks").orderBy("createdAt","desc").limit(6);
    const snap = await q.get();

    if (snap.empty) {
      taskList.innerHTML = emptyState("No tasks yet. Create one to get started.");
    } else {
      snap.forEach(doc => {
        const t = doc.data();
        if (role !== "admin" && t.assignedToUid !== uid) return;
        const div = document.createElement("div");
        div.className = "task-item";
        div.innerHTML = `
          <div class="task-dot dot-${(t.status||"todo").replace(" ","-")}"></div>
          <div class="task-body">
            <h4>${safe(t.title || "Untitled")}</h4>
            <p>${safe(t.assignedToName || "")}</p>
            <div class="task-meta-row">
              <span class="badge badge-${t.status||"todo"}">${t.status||"todo"}</span>
              ${t.priority ? `<span class="badge badge-${t.priority}">${t.priority}</span>` : ""}
            </div>
          </div>
        `;
        taskList.appendChild(div);
      });
    }
  }

  // team overview
  if (teamList && role === "admin") {
    teamList.innerHTML = "";
    const usnap = await db.collection("users").limit(6).get();
    usnap.forEach(doc => {
      const u = doc.data();
      const row = document.createElement("div");
      row.className = "member-row";
      row.innerHTML = `
        <div class="m-avatar">${initial(u.fullName || u.email)}</div>
        <div class="m-info">
          <strong>${safe(u.fullName || "Unnamed")}</strong>
          <small>${safe(u.email || "")}</small>
        </div>
        <span class="badge ${u.role === 'admin' ? 'badge-in-progress' : 'badge-low'}">${safe(u.role||"member")}</span>
      `;
      teamList.appendChild(row);
    });
  } else if (teamList) {
    teamList.parentElement.style.display = "none";
  }
}

/* ============================================================
   ALL TASKS
============================================================ */
async function loadAllTasks(statusFilter = "", priorityFilter = "") {
  const list = document.getElementById("allTaskList");
  if (!list) return;
  list.innerHTML = "";

  const role = window._userData?.role || "member";
  const uid  = window._user?.uid;

  const snap = await db.collection("tasks").orderBy("createdAt","desc").get();
  let count = 0;

  snap.forEach(doc => {
    const t = doc.data();
    if (role !== "admin" && t.assignedToUid !== uid) return;
    if (statusFilter   && t.status   !== statusFilter)   return;
    if (priorityFilter && t.priority !== priorityFilter) return;

    count++;
    const div = document.createElement("div");
    div.className = "task-item";
    div.innerHTML = `
      <div class="task-dot dot-${(t.status||"todo").replace(" ","-")}"></div>
      <div class="task-body">
        <h4>${safe(t.title || "Untitled")}</h4>
        <p>${safe(t.description || "")}</p>
        <div class="task-meta-row">
          <span class="badge badge-${t.status||"todo"}">${t.status||"todo"}</span>
          ${t.priority ? `<span class="badge badge-${t.priority}">${t.priority}</span>` : ""}
          ${t.dueDate  ? `<span class="badge badge-due">Due ${t.dueDate}</span>` : ""}
          ${t.assignedToName ? `<small style="color:var(--text-4)">→ ${safe(t.assignedToName)}</small>` : ""}
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  if (count === 0) list.innerHTML = emptyState("No tasks match your filters.");
}

/* ============================================================
   SEARCH
============================================================ */
document.getElementById("searchInput")?.addEventListener("input", async (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) { loadAllTasks(); return; }

  switchView("tasks");
  const list = document.getElementById("allTaskList");
  list.innerHTML = "";

  const snap = await db.collection("tasks").get();
  let count = 0;

  snap.forEach(doc => {
    const t = doc.data();
    const uid = window._user?.uid;
    const role = window._userData?.role || "member";
    if (role !== "admin" && t.assignedToUid !== uid) return;

    const match = (t.title||"").toLowerCase().includes(q) ||
                  (t.description||"").toLowerCase().includes(q) ||
                  (t.assignedToName||"").toLowerCase().includes(q);
    if (!match) return;

    count++;
    const div = document.createElement("div");
    div.className = "task-item";
    div.innerHTML = `
      <div class="task-dot dot-${(t.status||"todo").replace(" ","-")}"></div>
      <div class="task-body">
        <h4>${safe(t.title)}</h4>
        <p>${safe(t.description || "")}</p>
        <div class="task-meta-row">
          <span class="badge badge-${t.status||"todo"}">${t.status||"todo"}</span>
          ${t.assignedToName ? `<small style="color:var(--text-4)">→ ${safe(t.assignedToName)}</small>` : ""}
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  if (count === 0) list.innerHTML = emptyState(`No results for "${safe(q)}"`);
});

/* ============================================================
   PROFILE
============================================================ */
function populateProfile(user, data) {
  document.getElementById("pfFullName").value = data.fullName    || "";
  document.getElementById("pfEmail").value    = data.email       || user.email || "";
  document.getElementById("pfPhone").value    = data.phone       || "";
  document.getElementById("pfDob").value      = data.dob         || "";
  document.getElementById("pfAge").value      = data.age         || "";
  document.getElementById("pfAadhaar").value  = data.aadhaar     || "";
  document.getElementById("pfPan").value      = data.pan         || "";
  document.getElementById("pfCity").value     = data.city        || "";
  document.getElementById("pfState").value    = data.state       || "";
  document.getElementById("pfPin").value      = data.pinCode     || "";
  document.getElementById("pfAddress").value  = data.fullAddress || "";

  document.getElementById("profileInfo").innerHTML = [
    ["Name",    data.fullName || "—"],
    ["Email",   data.email || user.email],
    ["Role",    data.role || "member"],
    ["Phone",   data.phone || "—"],
    ["City",    data.city || "—"],
    ["State",   data.state || "—"],
    ["PIN",     data.pinCode || "—"],
    ["UID",     user.uid]
  ].map(([l,v]) => `
    <div class="info-row">
      <span class="ir-label">${l}</span>
      <span class="ir-val">${safe(v)}</span>
    </div>
  `).join("");
}

document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = window._user;
  if (!user) return;

  const updated = {
    fullName:    v("pfFullName"),
    phone:       v("pfPhone"),
    dob:         v("pfDob"),
    age:         Number(v("pfAge") || 0),
    aadhaar:     v("pfAadhaar"),
    pan:         v("pfPan"),
    city:        v("pfCity"),
    state:       v("pfState"),
    pinCode:     v("pfPin"),
    fullAddress: v("pfAddress"),
    email:       document.getElementById("pfEmail").value.trim()
  };

  await db.collection("users").doc(user.uid).set(updated, { merge: true });
  window._userData = { ...window._userData, ...updated };

  document.getElementById("sbName").textContent = updated.fullName || user.email;
  document.getElementById("sbAvatar").textContent = initial(updated.fullName || user.email);
  populateProfile(user, window._userData);

  showToast("Profile saved successfully");
});

/* ============================================================
   QUICK TASK MODAL
============================================================ */
document.getElementById("btnNewTask")?.addEventListener("click", () => {
  document.getElementById("taskModal").classList.remove("hidden");
});
document.getElementById("closeTaskModal")?.addEventListener("click", () => {
  document.getElementById("taskModal").classList.add("hidden");
});
document.getElementById("taskModal")?.addEventListener("click", (e) => {
  if (e.target.id === "taskModal") document.getElementById("taskModal").classList.add("hidden");
});

document.getElementById("quickTaskForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = window._user;
  if (!user) return;

  const title    = v("qtTitle");
  const desc     = v("qtDesc");
  const status   = document.getElementById("qtStatus").value;
  const priority = document.getElementById("qtPriority").value;

  if (!title) return;

  await db.collection("tasks").add({
    title, description: desc, status, priority,
    assignedToUid:  user.uid,
    assignedToName: window._userData?.fullName || user.email || "Me",
    dueDate: "",
    createdBy: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  document.getElementById("taskModal").classList.add("hidden");
  e.target.reset();
  showToast("Task created");
  updateStats();
  loadDashboard();
  loadAllTasks();
});

/* ============================================================
   NAV
============================================================ */
document.querySelectorAll(".sb-item, [data-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    const vw = btn.dataset.view;
    if (!vw) return;
    switchView(vw);
    if (vw === "admin")   { loadAdminMembers(); loadAssigneeDropdown(); }
    if (vw === "mytasks") { loadMemberTasks(window._user?.uid); }
    if (vw === "tasks")   { loadAllTasks(); }
    if (vw === "dashboard") { loadDashboard(); updateStats(); }
  });
});

/* ============================================================
   FILTERS
============================================================ */
document.getElementById("filterStatus")?.addEventListener("change", (e) => {
  const priority = document.getElementById("filterPriority").value;
  loadAllTasks(e.target.value, priority);
});
document.getElementById("filterPriority")?.addEventListener("change", (e) => {
  const status = document.getElementById("filterStatus").value;
  loadAllTasks(status, e.target.value);
});

/* ============================================================
   MOBILE SIDEBAR
============================================================ */
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("active");
}
document.getElementById("menuBtn")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarOverlay").classList.add("active");
});
document.getElementById("sidebarClose")?.addEventListener("click", closeSidebar);
document.getElementById("sidebarOverlay")?.addEventListener("click", closeSidebar);