// Real auth logic - uses backend API instead of localStorage
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
        message.textContent = "Use at least 8 characters for this password.";
        return;
      }

      // Send signup request to backend
      fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      })
      .then(response => response.json())
      .then(data => {
        if (data.needsVerification) {
          // Show confirmation code input
          message.textContent = `Check your email for confirmation code. Code: ${data.message}`;
          // In a real app, show a form to enter the code
          // For demo, auto-proceed after a short delay
          setTimeout(() => {
            window.location.href = "dashboard.html";
          }, 2000);
        } else {
          message.textContent = data.message;
          window.location.href = "dashboard.html";
        }
      })
      .catch(error => {
        console.error("Error:", error);
        message.textContent = "Error during signup. Please try again.";
      });
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", event => {
      event.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const confirmationCode = document.getElementById("loginPassword").value; // Using password field for confirmation code
      const message = document.getElementById("loginMessage");

      // Send signin request to backend
      fetch("/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, confirmationCode })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          message.textContent = "Logging in...";
          window.location.href = "dashboard.html";
        } else {
          message.textContent = data.error || "Login failed. Please try again.";
        }
      })
      .catch(error => {
        console.error("Error:", error);
        message.textContent = "Error during login. Please try again.";
      });
    });
  }
});
