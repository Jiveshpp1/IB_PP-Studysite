document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("materialsList");
  function renderMaterials() {
    const materials = getMaterials();
    if (!materials.length) {
      list.innerHTML = `<div class="empty-state"><span>▧</span><strong>No materials saved</strong><p>Add a resource to start building your library.</p><a href="upload.html">Add your first material →</a></div>`;
      return;
    }
    list.innerHTML = materials.map(item => `
      <article class="material-card">
        <span class="material-type">${escapeHtml(item.type)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.className || "General material")}</p>
        <p>${escapeHtml((item.notes || "").slice(0, 150) || "No notes or text added.")}${(item.notes || "").length > 150 ? "…" : ""}</p>
        <div class="card-actions"><small class="small-note">Saved material</small><button class="link-button" type="button" data-delete-material="${escapeHtml(item.id)}">Delete</button></div>
      </article>`).join("");
  }
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-material]");
    if (!button) return;
    saveStoredData(STORAGE_KEYS.materials, getMaterials().filter(item => item.id !== button.dataset.deleteMaterial));
    renderMaterials();
  });
  renderMaterials();
});
