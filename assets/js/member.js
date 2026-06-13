async function loadMemberTasks(uid) {
  const list = document.getElementById("memberTaskList");
  if (!list) return;
  list.innerHTML = "";

  const snap = await db.collection("tasks").orderBy("createdAt", "desc").get();

  if (snap.empty) {
    list.innerHTML = emptyState("No tasks available yet.");
    return;
  }

  snap.forEach(doc => {
    const t = doc.data();
    if (t.assignedToUid !== uid) return;

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
          <small style="color:var(--text-4)">Assigned to ${safe(t.assignedToName || "—")}</small>
        </div>
      </div>
      <div class="task-actions">
        ${t.status !== "done" ? `<button class="btn-ghost" style="font-size:12px;padding:6px 12px" onclick="setStatus('${doc.id}','in-progress','${uid}')">Start</button>` : ""}
        ${t.status !== "done" ? `<button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="setStatus('${doc.id}','done','${uid}')">Mark Done</button>` : ""}
      </div>
    `;
    list.appendChild(div);
  });

  if (!list.children.length) list.innerHTML = emptyState("No tasks assigned to you.");
}

window.loadMemberTasks = loadMemberTasks;