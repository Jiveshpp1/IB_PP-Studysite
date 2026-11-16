document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(location.search).get("id");
  const sourceList = document.getElementById("sourceList");
  const noteList = document.getElementById("noteList");
  const chatList = document.getElementById("notebookChats");
  if (!id || !/^\d+$/.test(id)) {
    document.getElementById("notebookTitle").textContent = "Notebook not found";
    return;
  }
  async function render() {
    const [notebook, data, chats] = await Promise.all([
      api(`/notebooks/${id}`), api(`/notebooks/${id}/notes`), api("/chats"),
    ]);
    document.title = `${notebook.title} — Study Space`;
    document.getElementById("notebookTitle").textContent = notebook.title;
    document.getElementById("notebookBreadcrumb").textContent = notebook.title;
    const ownNotes = data.notes;
    const ownSources = data.sources;
    notesCache = ownNotes;
    sourceList.innerHTML = ownSources.length ? ownSources.map(item => `<div class="class-row"><span class="quick-icon">▧</span><span class="row-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.file_name || "Text source")}</small></span><button class="link-button" type="button" data-download-source="${item.id}">Open</button><button class="link-button" type="button" data-delete-source="${item.id}">Delete</button></div>`).join("") : `<div class="empty-state"><strong>No sources yet</strong><p>Upload a document or paste text above.</p></div>`;
    noteList.innerHTML = ownNotes.length ? ownNotes.map(item => `<article class="material-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.content || "").replace(/\n/g, "<br>")}</p><div class="card-actions"><small class="small-note">${new Date(item.updated_at).toLocaleDateString()}</small><div><button class="link-button" type="button" data-edit-note="${item.id}">Edit</button><button class="link-button" type="button" data-delete-note="${item.id}">Delete</button></div></div></article>`).join("") : `<div class="empty-state"><strong>No notes saved</strong><p>Write a note above to keep key ideas close.</p></div>`;
    const ownChats = chats.filter(chat => Number(chat.notebook_id) === Number(id));
    chatList.innerHTML = ownChats.length ? ownChats.map(chat => `<a class="class-row" href="ai-chat.html?chat=${chat.id}"><span class="quick-icon">✦</span><span class="row-main"><strong>${escapeHtml(chat.title)}</strong><small>Open conversation</small></span><span>→</span></a>`).join("") : `<div class="empty-state"><strong>No notebook chats</strong><p>Create a conversation to study with your materials.</p></div>`;
  }
  document.getElementById("sourceForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("sourceMessage");
    const file = document.getElementById("sourceFile").files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      message.textContent = "Files must be 5 MB or smaller.";
      return;
    }
    try {
      const fileData = file ? (await fileToDataUrl(file)).split(",")[1] : null;
      await api("/sources", { method: "POST", body: JSON.stringify({
        notebook_id: Number(id),
        title: document.getElementById("sourceTitle").value.trim(),
        file_name: file?.name || null,
        mime_type: file?.type || null,
        content: document.getElementById("sourceContent").value.trim() || null,
        file_data: fileData,
      }) });
      event.target.reset();
      message.textContent = "Source saved.";
      await render();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  document.getElementById("noteForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("noteMessage");
    try {
      await api("/notes", { method: "POST", body: JSON.stringify({
        notebook_id: Number(id),
        title: document.getElementById("noteTitle").value.trim(),
        content: document.getElementById("noteContent").value.trim(),
      }) });
      event.target.reset();
      message.textContent = "Note saved.";
      await render();
    } catch (error) {
      message.textContent = error.message;
    }
  });
  sourceList.addEventListener("click", async event => {
    const button = event.target.closest("[data-download-source], [data-delete-source]");
    if (!button) return;
    try {
      if (button.dataset.deleteSource) {
        await api(`/sources/${button.dataset.deleteSource}`, { method: "DELETE" });
      } else {
        const source = await api(`/sources/${button.dataset.downloadSource}`);
        if (!source.file_data) {
          alert(source.content || "This source contains no file or text content.");
        } else {
          const bytes = Uint8Array.from(atob(source.file_data), char => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: source.mime_type || "application/octet-stream" }));
          const link = document.createElement("a");
          link.href = url; link.download = source.file_name || source.title; link.click();
          URL.revokeObjectURL(url);
        }
      }
      await render();
    } catch (error) { document.getElementById("sourceMessage").textContent = error.message; }
  });
  noteList.addEventListener("click", async event => {
    const button = event.target.closest("[data-edit-note], [data-delete-note]");
    if (!button) return;
    try {
      if (button.dataset.deleteNote) {
        await api(`/notes/${button.dataset.deleteNote}`, { method: "DELETE" });
      } else {
        const note = notesCache.find(item => item.id === Number(button.dataset.editNote));
        if (!note) return;
        const content = prompt("Edit note", note.content || "");
        if (content === null) return;
        await api(`/notes/${note.id}`, { method: "PATCH", body: JSON.stringify({ content }) });
      }
      await render();
    } catch (error) { document.getElementById("noteMessage").textContent = error.message; }
  });
  let notesCache = [];
  document.getElementById("newNotebookChat").addEventListener("click", async () => {
    try {
      const chat = await api("/chats", { method: "POST", body: JSON.stringify({ notebook_id: Number(id), title: `Chat — ${document.getElementById("notebookTitle").textContent}` }) });
      location.href = `ai-chat.html?chat=${chat.id}`;
    } catch (error) { document.getElementById("chatMessage").textContent = error.message; }
  });
  render().catch(error => { document.getElementById("sourceMessage").textContent = error.message; });
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
