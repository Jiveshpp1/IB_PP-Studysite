document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addClassForm");
  const message = document.getElementById("classFormMessage");
  const list = document.getElementById("classList");

  async function render() {
    try {
      const classes = await api("/classes");
      list.innerHTML = classes.length ? classes.map(item => `
        <article class="class-row">
          <span class="class-swatch ${escapeHtml(item.color)}">▤</span>
          <span class="row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.teacher || "No teacher added")}</small></span>
          <button class="link-button" type="button" data-edit="${item.id}">Edit</button>
          <button class="link-button" type="button" data-delete="${item.id}">Delete</button>
        </article>`).join("") : `<div class="empty-state"><span>▤</span><strong>No classes yet</strong><p>Use the form to add your first class.</p></div>`;
    } catch (error) {
      list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api("/classes", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("className").value.trim(),
          teacher: document.getElementById("classTeacher").value.trim() || null,
          color: document.getElementById("classColor").value,
        }),
      });
      form.reset();
      message.textContent = "Class added.";
      await render();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete], [data-edit]");
    if (!button) return;
    try {
      if (button.dataset.delete) {
        if (!confirm("Delete this class and its related study materials?")) return;
        await api(`/classes/${button.dataset.delete}`, { method: "DELETE" });
      } else {
        const name = prompt("Class name");
        if (name === null) return;
        const teacher = prompt("Teacher (optional)") || "";
        await api(`/classes/${button.dataset.edit}`, {
          method: "PATCH",
          body: JSON.stringify({ name: name.trim(), teacher: teacher.trim() || null }),
        });
      }
      await render();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  render();
});
