// Demo sign-up and login logic. Replace with a real auth provider/backend before production.
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", event => {
      event.preventDefault();
      const name = document.getElementById("signupName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const message = document.getElementById("signupMessage");
      if (password.length < 8) {
        message.textContent = "Use at least 8 characters for this demo password.";
        return;
      }
      // Demo only: never store real passwords in localStorage.
      saveStoredData(STORAGE_KEYS.user, { name, email });
      message.textContent = "Demo profile created. Opening your dashboard…";
      window.location.href = "dashboard.html";
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const message = document.getElementById("loginMessage");
      const savedUser = getCurrentUser();
      if (savedUser && savedUser.email.toLowerCase() === email.toLowerCase()) {
        message.textContent = "Logging in…";
        window.location.href = "dashboard.html";
      } else {
        message.textContent = "No matching demo profile found in this browser. Create an account first.";
      }
    });
  }
});
