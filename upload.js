document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addMaterialForm");
  const classSelect = document.getElementById("materialClass");
  const message = document.getElementById("materialFormMessage");

  function renderClassOptions() {
    const selectedValue = classSelect.value;
    classSelect.innerHTML = `<option value="">No class / general</option>` +
      getClasses().map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    classSelect.value = selectedValue;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = document.getElementById("materialTitle").value.trim();
    const type = document.getElementById("materialType").value;
    const classId = classSelect.value;
    const classItem = getClasses().find(item => item.id === classId);
    const notes = document.getElementById("materialNotes").value.trim();
    const fileInput = document.getElementById("materialFile");
    const selectedFileName = fileInput.files[0] ? fileInput.files[0].name : "";
    const materials = getMaterials();
    materials.unshift({
      id: makeId("material"), title, type, classId,
      className: classItem ? classItem.name : "",
      notes: notes || (selectedFileName ? `Selected file: ${selectedFileName} (not uploaded)` : ""),
      createdAt: new Date().toISOString()
    });
    saveStoredData(STORAGE_KEYS.materials, materials);
    form.reset();
    renderClassOptions();
    message.textContent = "Material details saved in this browser.";
  });
  renderClassOptions();
});
