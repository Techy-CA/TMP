let unsubscribeTasks = null;
let unsubscribeUsers = null;
let unsubscribeNotifs = null;
window.unsubscribeTasks = null;
window.unsubscribeUsers = null;
window.unsubscribeNotifs = null;

/* ── Helpers ─────────────────────────────── */
function safe(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function v(id) { return document.getElementById(id)?.value.trim() ?? ""; }
function initial(str) { return (str || "U")[0].toUpperCase(); }

function emptyState(msg) {
  return `<div class="empty-state">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
    <p>${safe(msg)}</p>
  </div>`;
}

/* ── Timestamp formatter ─────────────────── */
function formatDate(ts) {
  if (!ts) return "—";
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);

  if (diff < 60)     return "Just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 172800) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

/* ── Toast ───────────────────────────────── */
function showToast(msg) {
  const el = document.getElementById("toast");
  el.innerHTML = `<div style="display:flex;align-items:center;gap:10px">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    <span>${safe(msg)}</span>
  </div>`;
  el.classList.remove("hidden");
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.classList.add("hidden"), 3200);
}

/* ── Activity Notification Modal ─────────── */
function openUpdateModal(title, message) {
  document.getElementById("updateModalTitle").textContent = title || "Update";
  document.getElementById("updateModalDesc").textContent  = "New activity in your workspace.";
  document.getElementById("updateModalBody").innerHTML    = `<p style="color:var(--text-2);font-size:14px;line-height:1.7">${safe(message || "")}</p>`;
  document.getElementById("updateModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeUpdateModal() {
  document.getElementById("updateModal").classList.add("hidden");
  document.body.style.overflow = "";
}

/* ── Edit Task Modal ─────────────────────── */
window.editTask = async function(taskId) {
  const docSnap = await db.collection("tasks").doc(taskId).get();
  if (!docSnap.exists) { showToast("Task not found"); return; }
  const t = docSnap.data();

  document.getElementById("editTaskId").value    = taskId;
  document.getElementById("editTitle").value     = t.title        || "";
  document.getElementById("editDesc").value      = t.description  || "";
  document.getElementById("editStatus").value    = t.status       || "todo";
  document.getElementById("editPriority").value  = t.priority     || "medium";
  document.getElementById("editDueDate").value   = t.dueDate      || "";

  document.getElementById("editTaskModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

function closeEditModal() {
  document.getElementById("editTaskModal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("closeEditTaskModal")?.addEventListener("click", closeEditModal);
document.getElementById("editTaskModal")?.addEventListener("click", e => {
  if (e.target.id === "editTaskModal") closeEditModal();
});

document.getElementById("editTaskForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const taskId   = document.getElementById("editTaskId").value;
  const title    = document.getElementById("editTitle").value.trim();
  const desc     = document.getElementById("editDesc").value.trim();
  const status   = document.getElementById("editStatus").value;
  const priority = document.getElementById("editPriority").value;
  const dueDate  = document.getElementById("editDueDate").value;

  if (!title) { showToast("Title cannot be empty"); return; }

  await db.collection("tasks").doc(taskId).update({
    title, description: desc, status, priority, dueDate,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  closeEditModal();
  showToast("Task updated successfully");
  openUpdateModal("Task Updated", `"${title}" has been updated successfully.`);
});

/* ── Delete Confirm Modal ────────────────── */
window.deleteTask = function(taskId, taskTitle) {
  document.getElementById("deleteTaskId").value        = taskId;
  document.getElementById("deleteTaskName").textContent = `"${taskTitle || "this task"}"`;
  document.getElementById("deleteModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
};

function closeDeleteModal() {
  document.getElementById("deleteModal").classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("closeDeleteModal")?.addEventListener("click", closeDeleteModal);
document.getElementById("cancelDeleteBtn")?.addEventListener("click", closeDeleteModal);
document.getElementById("deleteModal")?.addEventListener("click", e => {
  if (e.target.id === "deleteModal") closeDeleteModal();
});

document.getElementById("confirmDeleteBtn")?.addEventListener("click", async () => {
  const taskId   = document.getElementById("deleteTaskId").value;
  const taskName = document.getElementById("deleteTaskName").textContent;
  if (!taskId) return;
  await db.collection("tasks").doc(taskId).delete();
  closeDeleteModal();
  showToast("Task deleted");
  openUpdateModal("Task Deleted", `${taskName} has been deleted.`);
});

/* ── Screen switch ───────────────────────── */
function showScreen(name) {
  const auth = document.getElementById("authScreen");
  const app  = document.getElementById("appScreen");
  if (name === "auth") { auth.classList.remove("hidden"); app.classList.add("hidden"); }
  else { auth.classList.add("hidden"); app.classList.remove("hidden"); }
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(vw => { vw.classList.remove("active-view"); vw.classList.add("hidden"); });
  const el = document.getElementById(`view-${name}`);
  if (el) { el.classList.remove("hidden"); el.classList.add("active-view"); }
  document.querySelectorAll(".sb-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  const meta = {
    dashboard: ["Dashboard",       "Live overview of tasks and team activity"],
    tasks:     ["Tasks",           "All tasks across the portal"],
    admin:     ["Team Members",    "Manage users and assignments"],
    mytasks:   ["My Tasks",        "Tasks assigned to you"],
    profile:   ["Profile & Settings", "Update your personal details"]
  };
  document.getElementById("pageTitle").textContent = meta[name]?.[0] ?? name;
  document.getElementById("pageSub").textContent   = meta[name]?.[1] ?? "";
  closeSidebar();
}

/* ── Notify helper ───────────────────────── */
async function notify(userId, title, message, type = "info") {
  await db.collection("notifications").add({
    userId, title, message, type, read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/* ── Render task card ────────────────────── */
function renderTask(doc, role, uid) {
  const t       = doc.data();
  const canEdit = role === "admin" || t.createdBy === uid || t.assignedToUid === uid;

  const createdStr = formatDate(t.createdAt);
  const updatedStr = (t.updatedAt && t.updatedAt?.seconds !== t.createdAt?.seconds)
    ? formatDate(t.updatedAt) : null;

  const div = document.createElement("div");
  div.className = "task-item";
  div.innerHTML = `
    <div class="task-dot dot-${(t.status || "todo").replace(" ","-")}"></div>
    <div class="task-body">
      <h4>${safe(t.title || "Untitled")}</h4>
      <p>${safe(t.description || "")}</p>
      <div class="task-meta-row">
        <span class="badge badge-${t.status||"todo"}">${t.status||"todo"}</span>
        ${t.priority ? `<span class="badge badge-${t.priority}">${t.priority}</span>` : ""}
        ${t.dueDate  ? `<span class="badge badge-due">📅 Due ${safe(t.dueDate)}</span>` : ""}
        <small style="color:var(--text-4)">👤 ${safe(t.assignedToName||"—")}</small>
      </div>
      <div class="task-timestamps">
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Added ${createdStr}
        </span>
        ${updatedStr ? `
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Updated ${updatedStr}
        </span>` : ""}
        ${t.createdByName ? `
        <span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          By ${safe(t.createdByName)}
        </span>` : ""}
      </div>
    </div>
    <div class="task-actions">
      ${canEdit ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="editTask('${doc.id}')">Edit</button>` : ""}
      ${canEdit ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px;color:#dc2626" onclick="deleteTask('${doc.id}','${safe(t.title||"")}')">Delete</button>` : ""}
      ${role === "admin" && t.assignedToUid === uid ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="cycleAdminTask('${doc.id}','${uid}')">Update Status</button>` : ""}
      ${role !== "admin" && t.assignedToUid === uid && t.status !== "done" ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="setStatus('${doc.id}','done','${uid}')">Mark Done</button>` : ""}
    </div>
  `;
  return div;
}

/* ── Init App ────────────────────────────── */
window.initApp = function(user, data) {
  const role = data.role || "member";
  window._user     = user;
  window._userData = data;

  document.body.classList.remove("role-admin","role-member");
  document.body.classList.add(`role-${role}`);

  document.getElementById("sbAvatar").textContent = initial(data.fullName || user.email);
  document.getElementById("sbName").textContent   = data.fullName || user.email || "User";
  document.getElementById("sbRole").textContent   = role;

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

  document.getElementById("profileInfo").innerHTML = `
    <div class="info-row"><span class="ir-label">Full Name</span><span class="ir-val">${safe(data.fullName||"—")}</span></div>
    <div class="info-row"><span class="ir-label">Email</span><span class="ir-val">${safe(data.email||user.email)}</span></div>
    <div class="info-row"><span class="ir-label">Role</span><span class="ir-val">${safe(role)}</span></div>
    <div class="info-row"><span class="ir-label">Phone</span><span class="ir-val">${safe(data.phone||"—")}</span></div>
    <div class="info-row"><span class="ir-label">City</span><span class="ir-val">${safe(data.city||"—")}</span></div>
    <div class="info-row"><span class="ir-label">State</span><span class="ir-val">${safe(data.state||"—")}</span></div>
  `;

  setupRealtime();
  showScreen("app");
  switchView("dashboard");
  showToast("Logged in successfully");
};

/* ── Realtime Listeners ──────────────────── */
function setupRealtime() {
  const role = window._userData?.role || "member";
  const uid  = window._user?.uid;

  if (unsubscribeTasks)  unsubscribeTasks();
  if (unsubscribeUsers)  unsubscribeUsers();
  if (unsubscribeNotifs) unsubscribeNotifs();

  unsubscribeTasks = db.collection("tasks").orderBy("createdAt","desc").onSnapshot(snap => {
    const dash = document.getElementById("dashTaskList");
    const all  = document.getElementById("allTaskList");
    const my   = document.getElementById("memberTaskList");
    if (dash) dash.innerHTML = "";
    if (all)  all.innerHTML  = "";
    if (my)   my.innerHTML   = "";

    let total=0, todo=0, prog=0, done=0;

    snap.forEach(doc => {
      const t = doc.data();
      total++;
      if (t.status === "todo")        todo++;
      if (t.status === "in-progress") prog++;
      if (t.status === "done")        done++;

      if (dash && (role === "admin" || t.assignedToUid === uid)) dash.appendChild(renderTask(doc, role, uid));
      if (all)  all.appendChild(renderTask(doc, role, uid));
      if (my && t.assignedToUid === uid) my.appendChild(renderTask(doc, role, uid));
    });

    document.getElementById("stTotal").textContent    = total;
    document.getElementById("stTodo").textContent     = todo;
    document.getElementById("stProgress").textContent = prog;
    document.getElementById("stDone").textContent     = done;

    if (dash && !dash.children.length) dash.innerHTML = emptyState("No tasks yet.");
    if (all  && !all.children.length)  all.innerHTML  = emptyState("No tasks found.");
    if (my   && !my.children.length)   my.innerHTML   = emptyState("No tasks assigned to you.");
  });

  unsubscribeUsers = db.collection("users").onSnapshot(snap => {
    const adminList   = document.getElementById("adminMemberList");
    const teamList    = document.getElementById("dashTeamList");
    const memberCount = document.getElementById("memberCount");
    const assignee    = document.getElementById("taskAssignee");

    if (adminList) adminList.innerHTML = "";
    if (teamList)  teamList.innerHTML  = "";
    if (assignee)  assignee.innerHTML  = '<option value="">Select team member</option>';

    let count = 0;
    snap.forEach(doc => {
      const u = doc.data();
      count++;

      if (adminList) {
        const row = document.createElement("div");
        row.className = "member-row";
        row.innerHTML = `
          <div class="m-avatar">${initial(u.fullName||u.email)}</div>
          <div class="m-info">
            <strong>${safe(u.fullName||"Unnamed")}</strong>
            <small>${safe(u.email||"")}</small>
          </div>
          <span class="badge ${u.role==="admin"?"badge-in-progress":"badge-low"}">${safe(u.role||"member")}</span>
          ${role==="admin" && doc.id!==uid
            ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px;color:#dc2626" onclick="removeUser('${doc.id}','${safe(u.fullName||u.email||"")}')">Remove</button>`
            : ""}
        `;
        adminList.appendChild(row);
      }

      if (teamList && role === "admin") {
        const row = document.createElement("div");
        row.className = "member-row";
        row.innerHTML = `
          <div class="m-avatar">${initial(u.fullName||u.email)}</div>
          <div class="m-info">
            <strong>${safe(u.fullName||"Unnamed")}</strong>
            <small>${safe(u.email||"")}</small>
          </div>
          <span class="badge ${u.role==="admin"?"badge-in-progress":"badge-low"}">${safe(u.role||"member")}</span>
        `;
        teamList.appendChild(row);
      }

      if (assignee) {
        const opt = document.createElement("option");
        opt.value       = doc.id;
        opt.textContent = `${u.fullName||"Unnamed"} — ${u.email||""}`;
        assignee.appendChild(opt);
      }
    });

    if (memberCount) memberCount.textContent = count;
  });

  let firstNotifLoad = true;
  unsubscribeNotifs = db.collection("notifications")
    .where("userId","==",uid)
    .orderBy("createdAt","desc")
    .onSnapshot(snap => {
      if (firstNotifLoad) { firstNotifLoad = false; return; }
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          const n = change.doc.data();
          showToast(`${n.title}: ${n.message}`);
        }
      });
    });

  window.unsubscribeTasks  = unsubscribeTasks;
  window.unsubscribeUsers  = unsubscribeUsers;
  window.unsubscribeNotifs = unsubscribeNotifs;
}

/* ── Filters ─────────────────────────────── */
document.getElementById("filterStatus")?.addEventListener("change", () => {
  window.loadAllTasks(document.getElementById("filterStatus").value, document.getElementById("filterPriority").value);
});
document.getElementById("filterPriority")?.addEventListener("change", () => {
  window.loadAllTasks(document.getElementById("filterStatus").value, document.getElementById("filterPriority").value);
});

window.loadAllTasks = function(statusFilter="", priorityFilter="") {
  const role = window._userData?.role || "member";
  const uid  = window._user?.uid;
  const list = document.getElementById("allTaskList");
  if (!list) return;
  list.innerHTML = "";
  db.collection("tasks").orderBy("createdAt","desc").get().then(snap => {
    let count = 0;
    snap.forEach(doc => {
      const t = doc.data();
      if (statusFilter   && t.status   !== statusFilter)   return;
      if (priorityFilter && t.priority !== priorityFilter) return;
      count++;
      list.appendChild(renderTask(doc, role, uid));
    });
    if (count === 0) list.innerHTML = emptyState("No tasks match your filters.");
  });
};

/* ── Search ──────────────────────────────── */
document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) return window.loadAllTasks(
    document.getElementById("filterStatus").value,
    document.getElementById("filterPriority").value
  );
  const list = document.getElementById("allTaskList");
  list.innerHTML = "";
  db.collection("tasks").orderBy("createdAt","desc").get().then(snap => {
    const role = window._userData?.role || "member";
    const uid  = window._user?.uid;
    let count  = 0;
    snap.forEach(doc => {
      const t = doc.data();
      if (role !== "admin" && t.assignedToUid !== uid) return;
      if (![t.title,t.description,t.assignedToName].join(" ").toLowerCase().includes(q)) return;
      count++;
      list.appendChild(renderTask(doc, role, uid));
    });
    if (count === 0) list.innerHTML = emptyState(`No results for "${q}"`);
  });
});

/* ── Profile save ────────────────────────── */
document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = window._user;
  if (!user) return;
  const updated = {
    fullName: v("pfFullName"), phone: v("pfPhone"), dob: v("pfDob"),
    age: Number(v("pfAge")||0), aadhaar: v("pfAadhaar"), pan: v("pfPan"),
    city: v("pfCity"), state: v("pfState"), pinCode: v("pfPin"),
    fullAddress: v("pfAddress"), email: document.getElementById("pfEmail").value.trim()
  };
  await db.collection("users").doc(user.uid).set(updated, { merge: true });
  window._userData = { ...window._userData, ...updated };
  document.getElementById("sbName").textContent   = updated.fullName || user.email;
  document.getElementById("sbAvatar").textContent = initial(updated.fullName || user.email);
  showToast("Profile saved");
  openUpdateModal("Profile Updated", "Your profile has been saved successfully.");
});

/* ── Create Task Modal ───────────────────── */
document.getElementById("btnNewTask")?.addEventListener("click", () => {
  document.getElementById("taskModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
});
document.getElementById("closeTaskModal")?.addEventListener("click", () => {
  document.getElementById("taskModal").classList.add("hidden");
  document.body.style.overflow = "";
});
document.getElementById("taskModal")?.addEventListener("click", e => {
  if (e.target.id === "taskModal") {
    document.getElementById("taskModal").classList.add("hidden");
    document.body.style.overflow = "";
  }
});

document.getElementById("quickTaskForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = window._user;
  if (!user) return;
  const title = v("qtTitle");
  if (!title) return;

  await db.collection("tasks").add({
    title,
    description:    v("qtDesc"),
    status:         document.getElementById("qtStatus").value,
    priority:       document.getElementById("qtPriority").value,
    assignedToUid:  user.uid,
    assignedToName: window._userData?.fullName || user.email || "Me",
    dueDate:        "",
    createdBy:      user.uid,
    createdByName:  window._userData?.fullName || user.email || "",
    createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:      firebase.firestore.FieldValue.serverTimestamp()
  });

  await notify(user.uid, "Task created", `"${title}" was created`, "success");
  document.getElementById("taskModal").classList.add("hidden");
  document.body.style.overflow = "";
  e.target.reset();
  showToast("Task created");
  openUpdateModal("Task Created", `"${title}" has been created successfully.`);
});

/* ── Status helpers ──────────────────────── */
window.setStatus = async function(taskId, status, uid) {
  const docSnap = await db.collection("tasks").doc(taskId).get();
  const t = docSnap.data();
  await db.collection("tasks").doc(taskId).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await notify(uid, "Task updated", `"${t.title}" marked as ${status}`, "success");
  showToast(`Task marked as ${status}`);
  openUpdateModal("Task Updated", `"${t.title}" has been marked as ${status}.`);
};

window.cycleAdminTask = async function(taskId, uid) {
  const docSnap = await db.collection("tasks").doc(taskId).get();
  const t    = docSnap.data();
  const next = t.status === "todo" ? "in-progress" : t.status === "in-progress" ? "done" : "todo";
  await db.collection("tasks").doc(taskId).update({
    status: next,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await notify(uid, "Task updated", `"${t.title}" → ${next}`, "success");
  showToast(`Status updated to ${next}`);
  openUpdateModal("Task Updated", `"${t.title}" has been moved to ${next}.`);
};

/* ── Remove user ─────────────────────────── */
window.removeUser = async function(userId, userName) {
  if (!confirm(`Remove ${userName || "this user"} from the portal?`)) return;
  const tasks = await db.collection("tasks").where("assignedToUid","==",userId).get();
  const batch = db.batch();
  tasks.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection("users").doc(userId));
  await batch.commit();
  showToast("User removed");
  openUpdateModal("User Removed", `${userName || "The user"} has been removed from the portal.`);
};

/* ── Nav & Sidebar ───────────────────────── */
document.querySelectorAll(".sb-item, [data-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    const vw = btn.dataset.view;
    if (vw) switchView(vw);
  });
});

document.getElementById("menuBtn")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebarOverlay")?.classList.add("active");
});
document.getElementById("sidebarClose")?.addEventListener("click", closeSidebar);
document.getElementById("sidebarOverlay")?.addEventListener("click", closeSidebar);

/* ── Activity Modal controls ─────────────── */
document.getElementById("closeUpdateModal")?.addEventListener("click", closeUpdateModal);
document.getElementById("dismissUpdateModal")?.addEventListener("click", closeUpdateModal);
document.getElementById("goToTasksBtn")?.addEventListener("click", () => { closeUpdateModal(); switchView("tasks"); });
document.getElementById("updateModal")?.addEventListener("click", e => {
  if (e.target.id === "updateModal") closeUpdateModal();
});

/* ── Logout ──────────────────────────────── */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (unsubscribeTasks)  unsubscribeTasks();
  if (unsubscribeUsers)  unsubscribeUsers();
  if (unsubscribeNotifs) unsubscribeNotifs();
  await auth.signOut();
  showScreen("auth");
});