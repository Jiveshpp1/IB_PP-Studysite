// Shared browser-only helpers used by every Study Space page.
const STORAGE_KEYS = {
  user: "studySpaceUser",
  classes: "studySpaceClasses",
  materials: "studySpaceMaterials"
};

function readStoredData(key, fallback = []) {
  try {
    const savedValue = localStorage.getItem(key);
    return savedValue ? JSON.parse(savedValue) : fallback;
  } catch (error) {
    console.warn("Could not read saved Study Space data:", error);
    return fallback;
  }
}

function saveStoredData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCurrentUser() {
  return readStoredData(STORAGE_KEYS.user, null);
}

function getClasses() {
  return readStoredData(STORAGE_KEYS.classes, []);
}

function getMaterials() {
  return readStoredData(STORAGE_KEYS.materials, []);
}

function makeId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
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
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEYS.user);
      window.location.href = "index.html";
    });
  }
});
