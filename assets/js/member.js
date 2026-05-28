/* ── My Tasks ────────────────────────────── */
async function loadMemberTasks(uid) {
  const list = document.getElementById("memberTaskList");
  if (!list) return;
  list.innerHTML = "";

  const snap = await db.collection("tasks")
    .where("assignedToUid", "==", uid)
    .get();

  if (snap.empty) {
    list.innerHTML = emptyState("No tasks assigned to you yet.");
    return;
  }

  snap.forEach(doc => {
    const t = doc.data();
    const div = document.createElement("div");
    div.className = "task-item";
    div.innerHTML = `
      <div class="task-dot dot-${(t.status || "todo").replace(" ","-")}"></div>
      <div class="task-body">
        <h4>${safe(t.title || "Untitled")}</h4>
        <p>${safe(t.description || "")}</p>
        <div class="task-meta-row">
          <span class="badge badge-${t.status || "todo"}">${t.status || "todo"}</span>
          ${t.priority ? `<span class="badge badge-${t.priority}">${t.priority}</span>` : ""}
          ${t.dueDate  ? `<span class="badge badge-due">Due ${t.dueDate}</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        ${t.status === "todo"        ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="setStatus('${doc.id}','in-progress','${uid}')">Start</button>` : ""}
        ${t.status === "in-progress" ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="setStatus('${doc.id}','done','${uid}')">Mark Done</button>` : ""}
        ${t.status === "done"        ? `<span class="badge badge-done">Completed</span>` : ""}
      </div>
    `;
    list.appendChild(div);
  });
}

async function setStatus(taskId, status, uid) {
  await db.collection("tasks").doc(taskId).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  showToast(`Task marked as ${status}`);
  loadMemberTasks(uid);
  loadAllTasks();
  loadDashboard();
  updateStats();
}