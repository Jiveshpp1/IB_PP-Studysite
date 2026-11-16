// Shared browser-only helpers used by every Study Space page.
// No localStorage dependencies - user state managed by backend API

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, character => ({
    "&": "&amp",
    "<": "&lt",
    ">": "&gt",
    '"': "&quot",
    "'": "&#39"
  })[character]);
}

document.addEventListener("DOMContentLoaded", () => {
  // Get current user from backend session
  async function getCurrentUser() {
    try {
      const response = await fetch("/auth/session");
      const data = await response.json();
      if (data.isLoggedIn) {
        return { name: "Student", email: "" };
      }
      return null;
    } catch (error) {
      console.warn("Could not fetch current user from backend:", error);
      return null;
    }
  }

  getCurrentUser().then(user => {
    const displayName = document.getElementById("userDisplayName");
    const avatar = document.getElementById("userAvatar");
    if (user && displayName) displayName.textContent = user.name || "Student";
    if (user && avatar) avatar.textContent = (user.name || "S").trim().charAt(0).toUpperCase();
    const menuToggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("appSidebar");
    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }
    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        await fetch("/auth/logout", { method: "POST" });
        localStorage.removeItem("session_token");
        window.location.href = "index.html";
      });
    }
  });
});
