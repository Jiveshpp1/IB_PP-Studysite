document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { user } = await api("/auth/session");
    document.getElementById("profileName").value = user.name;
    document.getElementById("profileEmail").value = user.email;
  } catch (error) { document.getElementById("profileMessage").textContent = error.message; }
  document.getElementById("profileForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const result = await api("/profile", { method: "PATCH", body: JSON.stringify({ name: document.getElementById("profileName").value.trim() }) });
      document.getElementById("userDisplayName").textContent = result.user.name;
      document.getElementById("profileMessage").textContent = "Profile updated.";
    } catch (error) { document.getElementById("profileMessage").textContent = error.message; }
  });
});
