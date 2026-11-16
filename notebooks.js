document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("notebookList");
  const message = document.getElementById("notebookMessage");
  const form = document.getElementById("notebookForm");
  const classSelect = document.getElementById("notebookClass");
  async function render() {
    try {
      const [notebooks, classes] = await Promise.all([api("/notebooks"), api("/classes")]);
      classSelect.innerHTML = `<option value="">No class</option>${classes.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
      list.innerHTML = notebooks.length ? notebooks.map(item => `
        <article class="material-card">
          <span class="material-type">NOTEBOOK</span><h3>${escapeHtml(item.title)}</h3>
          <p>Updated ${new Date(item.updated_at).toLocaleDateString()}</p>
          <div class="card-actions"><a class="text-link" href="notebook.html?id=${item.id}">Open notebook →</a><div><button class="link-button" type="button" data-rename="${item.id}">Rename</button><button class="link-button" type="button" data-delete="${item.id}">Delete</button></div></div>
        </article>`).join("") : `<div class="empty-state"><span>▧</span><strong>No notebooks yet</strong><p>Create a notebook for your next subject.</p></div>`;
    } catch (error) {
      list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const notebook = await api("/notebooks", { method: "POST", body: JSON.stringify({
        title: document.getElementById("notebookTitle").value.trim(),
        class_id: classSelect.value ? Number(classSelect.value) : null,
      }) });
      location.href = `notebook.html?id=${notebook.id}`;
    } catch (error) {
      message.textContent = error.message;
    }
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-rename], [data-delete]");
    if (!button) return;
    try {
      if (button.dataset.delete) {
        if (!confirm("Delete this notebook, its sources, and notes?")) return;
        await api(`/notebooks/${button.dataset.delete}`, { method: "DELETE" });
      } else {
        const title = prompt("Notebook name");
        if (title === null) return;
        await api(`/notebooks/${button.dataset.rename}`, { method: "PATCH", body: JSON.stringify({ title: title.trim() }) });
      }
      await render();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  render();
});
