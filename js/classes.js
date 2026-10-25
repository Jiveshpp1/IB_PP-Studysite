document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addClassForm");
  const message = document.getElementById("classFormMessage");
  const classList = document.getElementById("classList");

  function renderClasses() {
    const classes = getClasses();
    if (!classes.length) {
      classList.innerHTML = `<div class="empty-state"><span>▤</span><strong>No classes yet</strong><p>Use the form to add your first class.</p></div>`;
      return;
    }
    classList.innerHTML = classes.map(item => `
      <div class="class-row">
        <span class="class-swatch ${escapeHtml(item.color)}">▤</span>
        <span class="row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.teacher || "No teacher added")}</small></span>
        <button class="link-button" type="button" data-delete-class="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)}">Remove</button>
      </div>`).join("");
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = document.getElementById("className").value.trim();
    const teacher = document.getElementById("classTeacher").value.trim();
    const color = document.getElementById("classColor").value;
    if (!name) {
      message.textContent = "Please enter a class name.";
      return;
    }
    const classes = getClasses();
    classes.push({ id: makeId("class"), name, teacher, color, createdAt: new Date().toISOString() });
    saveStoredData(STORAGE_KEYS.classes, classes);
    form.reset();
    message.textContent = "Class added.";
    renderClasses();
  });

  classList.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-class]");
    if (!button) return;
    const remaining = getClasses().filter(item => item.id !== button.dataset.deleteClass);
    saveStoredData(STORAGE_KEYS.classes, remaining);
    renderClasses();
  });
  renderClasses();
});
