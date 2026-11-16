document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("materialsList");
  async function render() {
    const [sources, notebooks] = await Promise.all([api("/sources"), api("/notebooks")]);
    const notebookNames = new Map(notebooks.map(item => [Number(item.id), item.title]));
    list.innerHTML = sources.length ? sources.map(item => `
      <article class="material-card">
        <span class="material-type">${escapeHtml(item.mime_type || "SOURCE")}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(notebookNames.get(Number(item.notebook_id)) || "Notebook")}</p>
        <p>${escapeHtml(item.file_name || "Text source")}</p>
        <div class="card-actions"><a class="text-link" href="notebook.html?id=${item.notebook_id}">Open notebook →</a><button class="link-button" type="button" data-delete="${item.id}">Delete</button></div>
      </article>`).join("") : `<div class="empty-state"><span>▧</span><strong>No sources saved</strong><p>Add a source to one of your notebooks.</p><a href="notebooks.html">Open notebooks →</a></div>`;
  }
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    try { await api(`/sources/${button.dataset.delete}`, { method: "DELETE" }); await render(); }
    catch (error) { list.insertAdjacentHTML("afterbegin", `<p class="form-message">${escapeHtml(error.message)}</p>`); }
  });
  render().catch(error => { list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; });
});
