document.addEventListener("DOMContentLoaded", async () => {
  const date = document.getElementById("todayDate");
  if (date) date.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  try {
    const [{ user }, dashboard, classes] = await Promise.all([api("/auth/session"), api("/dashboard"), api("/classes")]);
    const heading = document.getElementById("welcomeHeading");
    if (heading) heading.textContent = `Welcome back, ${user.name.split(" ")[0]}!`;
    document.getElementById("classCount").textContent = dashboard.stats.classes;
    document.getElementById("materialCount").textContent = dashboard.stats.notebooks;
    const classList = document.getElementById("dashboardClasses");
    classList.innerHTML = classes.length ? classes.slice(0, 4).map(item => `
      <a class="class-row" href="classes.html">
        <span class="class-swatch ${escapeHtml(item.color)}">▤</span>
        <span class="row-main"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.teacher || "Your class workspace")}</small></span><span class="task-arrow">→</span>
      </a>`).join("") : `<div class="empty-state"><span>▤</span><strong>No classes yet</strong><p>Add your first class to get organized.</p><a href="classes.html">Add a class →</a></div>`;
    const assignmentList = document.getElementById("upcomingAssignments");
    if (assignmentList) assignmentList.innerHTML = dashboard.assignments.length ? dashboard.assignments.map(item => `
      <a class="class-row" href="assignments.html"><span class="quick-icon">◷</span><span class="row-main"><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.due_at).toLocaleString()}</small></span></a>`).join("") : `<div class="empty-state"><strong>Nothing due soon</strong><p>Your upcoming assignments will show here.</p><a href="assignments.html">Add an assignment →</a></div>`;
  } catch (error) {
    document.getElementById("dashboardMessage").textContent = error.message;
  }
});
