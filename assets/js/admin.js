/* ── Team Members List ───────────────────── */
async function loadAdminMembers() {
  const list = document.getElementById("adminMemberList");
  if (!list) return;
  list.innerHTML = "";

  const snap = await db.collection("users").get();
  let count = 0;

  snap.forEach(doc => {
    const u = doc.data();
    count++;
    const row = document.createElement("div");
    row.className = "member-row";
    row.innerHTML = `
      <div class="m-avatar">${initial(u.fullName || u.email)}</div>
      <div class="m-info">
        <strong>${safe(u.fullName || "Unnamed")}</strong>
        <small>${safe(u.email || "")}</small>
      </div>
      <span class="badge ${u.role === 'admin' ? 'badge-in-progress' : 'badge-low'}">${safe(u.role || "member")}</span>
    `;
    list.appendChild(row);
  });

  const el = document.getElementById("memberCount");
  if (el) el.textContent = count;
}

/* ── Assignee Dropdown ───────────────────── */
async function loadAssigneeDropdown() {
  const sel = document.getElementById("taskAssignee");
  if (!sel) return;
  sel.innerHTML = '<option value="">Select team member</option>';

  const snap = await db.collection("users").get();
  snap.forEach(doc => {
    const u = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${u.fullName || "Unnamed"} — ${u.email || ""}`;
    sel.appendChild(opt);
  });
}

/* ── Assign Task ─────────────────────────── */
document.getElementById("assignTaskForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title         = v("taskTitle");
  const description   = v("taskDesc");
  const assignedToUid = document.getElementById("taskAssignee").value;
  const priority      = document.getElementById("taskPriority").value;
  const dueDate       = document.getElementById("taskDue").value;

  if (!title)          { showToast("Task title is required"); return; }
  if (!assignedToUid)  { showToast("Please select a team member"); return; }

  const udoc  = await db.collection("users").doc(assignedToUid).get();
  const udata = udoc.data() || {};

  await db.collection("tasks").add({
    title, description,
    assignedToUid,
    assignedToName: udata.fullName || udata.email || "Member",
    status: "todo", priority, dueDate,
    createdBy: window._user?.uid || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  e.target.reset();
  showToast("Task assigned successfully");
  loadAllTasks();
  loadDashboard();
});