document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  signupForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("signupMessage");
    const submit = signupForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = "Creating your account…";
    try {
      const result = await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("signupName").value.trim(),
          email: document.getElementById("signupEmail").value.trim(),
          password: document.getElementById("signupPassword").value,
        }),
      });
      location.href = `verify.html?email=${encodeURIComponent(result.email)}`;
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
    }
  });

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("loginMessage");
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = "Signing in…";
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value,
        }),
      });
      location.href = "dashboard.html";
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
      if (error.message.includes("verify")) {
        const email = document.getElementById("loginEmail").value.trim();
        message.innerHTML = `${escapeHtml(error.message)} <a href="verify.html?email=${encodeURIComponent(email)}">Verify email</a>`;
      }
    }
  });

  const verifyForm = document.getElementById("verifyForm");
  verifyForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("verifyMessage");
    try {
      await api("/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("verifyEmail").value.trim(),
          code: document.getElementById("verifyCode").value.trim(),
        }),
      });
      location.href = "dashboard.html";
    } catch (error) {
      message.textContent = error.message;
    }
  });

  document.getElementById("resendCode")?.addEventListener("click", async () => {
    const message = document.getElementById("verifyMessage");
    try {
      const result = await api("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: document.getElementById("verifyEmail").value.trim() }),
      });
      message.textContent = result.message;
    } catch (error) {
      message.textContent = error.message;
    }
  });

  const forgotForm = document.getElementById("forgotForm");
  forgotForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("forgotMessage");
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: document.getElementById("forgotEmail").value.trim() }),
      });
      location.href = `reset-password.html?email=${encodeURIComponent(document.getElementById("forgotEmail").value.trim())}`;
    } catch (error) {
      message.textContent = error.message;
    }
  });

  const resetForm = document.getElementById("resetForm");
  resetForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("resetMessage");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("resetEmail").value.trim(),
          code: document.getElementById("resetCode").value.trim(),
          password: document.getElementById("resetPassword").value,
        }),
      });
      message.textContent = "Password updated. Redirecting to sign in…";
      setTimeout(() => location.href = "login.html", 1200);
    } catch (error) {
      message.textContent = error.message;
    }
  });

  const emailField = document.getElementById("verifyEmail") || document.getElementById("resetEmail");
  if (emailField) emailField.value = new URLSearchParams(location.search).get("email") || "";
});
