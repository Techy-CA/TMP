async function loadAdminMembers() {
  const list = document.getElementById("adminMemberList");
  if (!list) return;
  list.innerHTML = "";

  const snap = await db.collection("users").orderBy("fullName").get();
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
      ${window._userData?.role === "admin" && doc.id !== window._user.uid ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px;color:#dc2626" onclick="removeUser('${doc.id}')">Remove</button>` : ""}
    `;
    list.appendChild(row);
  });

  const el = document.getElementById("memberCount");
  if (el) el.textContent = count;
}

async function loadAssigneeDropdown() {
  const sel = document.getElementById("taskAssignee");
  if (!sel) return;
  sel.innerHTML = '<option value="">Select team member</option>';

  const snap = await db.collection("users").orderBy("fullName").get();
  snap.forEach(doc => {
    const u = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${u.fullName || "Unnamed"} — ${u.email || ""}`;
    sel.appendChild(opt);
  });
}

document.getElementById("assignTaskForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = v("taskTitle");
  const description = v("taskDesc");
  const assignedToUid = document.getElementById("taskAssignee").value;
  const priority = document.getElementById("taskPriority").value;
  const dueDate = document.getElementById("taskDue").value;

  if (!title) { showToast("Task title is required"); return; }
  if (!assignedToUid) { showToast("Please select a team member"); return; }

  const udoc = await db.collection("users").doc(assignedToUid).get();
  const udata = udoc.data() || {};

  await db.collection("tasks").add({
    title,
    description,
    assignedToUid,
    assignedToName: udata.fullName || udata.email || "Member",
    status: "todo",
    priority,
    dueDate,
    createdBy: window._user?.uid || "",
    createdByName: window._userData?.fullName || window._user?.email || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  e.target.reset();
  showToast("Task assigned successfully");
  await notify(assignedToUid, "New task assigned", title, "success");
  await notify(window._user.uid, "Task created", title, "success");
});

window.removeUser = async function(userId) {
  if (!confirm("Remove this user and their tasks?")) return;

  const tasksSnap = await db.collection("tasks").where("assignedToUid", "==", userId).get();
  const batch = db.batch();
  tasksSnap.forEach(d => batch.delete(d.ref));
  batch.delete(db.collection("users").doc(userId));
  await batch.commit();

  showToast("User removed");
};