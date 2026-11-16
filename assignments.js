document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("assignmentList");
  let assignments = [];
  async function render() {
    [assignments] = await Promise.all([api("/assignments")]);
    assignments.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    const classes = await api("/classes");
    const classNames = new Map(classes.map(item => [Number(item.id), item.name]));
    document.getElementById("assignmentClass").innerHTML = `<option value="">No class</option>${classes.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
    list.innerHTML = assignments.length ? assignments.map(item => `<article class="class-row"><input type="checkbox" data-complete="${item.id}" ${item.completed ? "checked" : ""} aria-label="Mark ${escapeHtml(item.title)} complete"><span class="row-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(classNames.get(Number(item.class_id)) || "General")} · Due ${new Date(item.due_at).toLocaleString()}${item.description ? ` · ${escapeHtml(item.description)}` : ""}</small></span><button class="link-button" type="button" data-edit="${item.id}">Edit</button><button class="link-button" type="button" data-delete="${item.id}">Delete</button></article>`).join("") : `<div class="empty-state"><strong>No assignments yet</strong><p>Add your next task to keep it on your radar.</p></div>`;
  }
  document.getElementById("assignmentForm").addEventListener("submit", async event => {
    event.preventDefault();
    const date = document.getElementById("assignmentDue").value;
    try {
      await api("/assignments", { method: "POST", body: JSON.stringify({
        title: document.getElementById("assignmentTitle").value.trim(),
        description: document.getElementById("assignmentDescription").value.trim() || null,
        due_at: date ? `${date.replace("T", " ")}:00` : "",
        class_id: document.getElementById("assignmentClass").value ? Number(document.getElementById("assignmentClass").value) : null,
      }) });
      event.target.reset();
      document.getElementById("assignmentMessage").textContent = "Assignment added.";
      await render();
    } catch (error) { document.getElementById("assignmentMessage").textContent = error.message; }
  });
  list.addEventListener("change", async event => {
    const box = event.target.closest("[data-complete]");
    if (!box) return;
    try { await api(`/assignments/${box.dataset.complete}`, { method: "PATCH", body: JSON.stringify({ completed: box.checked }) }); await render(); }
    catch (error) { document.getElementById("assignmentMessage").textContent = error.message; }
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-edit], [data-delete]");
    if (!button) return;
    const item = assignments.find(row => row.id === Number(button.dataset.edit || button.dataset.delete));
    try {
      if (button.dataset.delete) {
        await api(`/assignments/${item.id}`, { method: "DELETE" });
      } else {
        const title = prompt("Assignment title", item.title);
        if (title === null) return;
        const description = prompt("Description", item.description || "");
        if (description === null) return;
        await api(`/assignments/${item.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), description: description.trim() || null }) });
      }
      await render();
    } catch (error) { document.getElementById("assignmentMessage").textContent = error.message; }
  });
  render().catch(error => { list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; });
});
