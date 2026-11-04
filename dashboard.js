document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  const welcomeHeading = document.getElementById("welcomeHeading");
  if (user && welcomeHeading) welcomeHeading.textContent = `Welcome back, ${(user.name || "student").split(" ")[0]}!`;
  const classes = getClasses();
  const materials = getMaterials();
  document.getElementById("classCount").textContent = classes.length;
  document.getElementById("materialCount").textContent = materials.length;
  const list = document.getElementById("dashboardClasses");
  if (!classes.length) return;
  list.innerHTML = classes.slice(0, 4).map(item => `
    <a class="class-row" href="classes.html">
      <span class="class-swatch ${escapeHtml(item.color || "sage")}">▤</span>
      <span class="row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.teacher || "Your class workspace")}</small></span>
      <span class="task-arrow">→</span>
    </a>`).join("");
});
