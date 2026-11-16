document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("serviceStatus");
  try {
    const config = await api("/config");
    const rows = [
      ["Email verification (Resend)", config.emailVerification],
      ["Google sign-in", config.googleSignIn],
      ["AI chat", config.aiChat],
    ];
    status.innerHTML = rows.map(([name, enabled]) => `<div class="class-row"><span class="row-main"><strong>${name}</strong><small>${enabled ? "Configured" : "Needs server configuration"}</small></span><span class="status-dot" style="background:${enabled ? "#60ca9c" : "#8a8fa2"}"></span></div>`).join("");
  } catch (error) { status.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`; }
});
