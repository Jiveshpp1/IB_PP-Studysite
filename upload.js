document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("addMaterialForm");
  const notebookSelect = document.getElementById("materialNotebook");
  const message = document.getElementById("materialFormMessage");
  try {
    const notebooks = await api("/notebooks");
    notebookSelect.innerHTML = notebooks.length ? notebooks.map(item => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("") : `<option value="">Create a notebook first</option>`;
  } catch (error) {
    notebookSelect.innerHTML = `<option value="">Could not load notebooks</option>`;
    message.textContent = error.message;
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const file = document.getElementById("materialFile").files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      message.textContent = "Files must be 5 MB or smaller.";
      return;
    }
    try {
      const fileData = file ? (await readFile(file)).split(",")[1] : null;
      const result = await api("/sources", { method: "POST", body: JSON.stringify({
        notebook_id: Number(notebookSelect.value),
        title: document.getElementById("materialTitle").value.trim(),
        file_name: file?.name || null,
        mime_type: file?.type || null,
        content: document.getElementById("materialNotes").value.trim() || null,
        file_data: fileData,
      }) });
      location.href = `notebook.html?id=${result.notebook_id}`;
    } catch (error) { message.textContent = error.message; }
  });
});

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
