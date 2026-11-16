function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && document.body.classList.contains("app-page")) {
      window.location.href = "login.html";
    }
    throw new Error(data.error || "The request could not be completed.");
  }
  return data;
}

window.escapeHtml = escapeHtml;
window.api = api;

document.addEventListener("DOMContentLoaded", async () => {
  const sidebar = document.getElementById("appSidebar");
  if (sidebar) {
    const links = [
      ["WORKSPACE", [["Dashboard", "dashboard.html", "▦"], ["My Classes", "classes.html", "▤"], ["Notebooks", "notebooks.html", "▧"], ["Assignments", "assignments.html", "✓"], ["Calendar", "calendar.html", "◷"]]],
      ["STUDY TOOLS", [["Flashcards", "flashcard-creator.html", "▱"], ["Quizzes", "quizzes.html", "☷"], ["AI Chat", "ai-chat.html", "✦"]]],
      ["ACCOUNT", [["Settings", "settings.html", "⚙"], ["Profile", "profile.html", "○"]]],
    ];
    const current = location.pathname.split("/").pop();
    sidebar.innerHTML = `
      <a class="brand sidebar-brand" href="dashboard.html"><span class="brand-mark">S</span><span>Study Space</span></a>
      ${links.map(([label, items]) => `<div class="sidebar-group"><div class="sidebar-label">${label}</div><nav class="side-nav" aria-label="${label}">${items.map(([name, href, icon]) => `<a class="side-link ${current === href ? "active" : ""}" href="${href}"><span class="side-icon">${icon}</span><span>${name}</span></a>`).join("")}</nav></div>`).join("")}
      <div class="sidebar-bottom"><div class="sidebar-tip"><span class="tip-icon">✦</span><strong>One thing at a time.</strong><p>A focused session is a good start.</p></div><button id="logoutButton" class="side-link sidebar-logout" type="button"><span class="side-icon">↩</span><span>Log out</span></button></div>`;
  }

  const appPage = document.body.classList.contains("app-page");
  if (!appPage) return;
  try {
    const { user } = await api("/auth/session");
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const displayName = document.getElementById("userDisplayName");
    const avatar = document.getElementById("userAvatar");
    if (displayName) displayName.textContent = user.name;
    if (avatar) avatar.textContent = user.name.trim().charAt(0).toUpperCase();
    const logout = document.getElementById("logoutButton");
    logout?.addEventListener("click", async () => {
      try {
        await api("/auth/logout", { method: "POST" });
        window.location.href = "index.html";
      } catch (error) {
        alert(error.message);
      }
    });
  } catch (error) {
    console.error(error);
  }
  document.getElementById("menuToggle")?.addEventListener("click", () => sidebar?.classList.toggle("open"));
});
