(function () {
  "use strict";

  const message = document.getElementById("dashboard-message");
  const logoutButton = document.getElementById("logout-button");

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/me");
      if (!response.ok) {
        window.location.replace("/");
        return;
      }
      const result = await response.json();
      document.getElementById("username").textContent = result.user.username;
      document.getElementById("session-email").textContent = result.user.email;
    } catch (error) {
      message.textContent = `Unable to load session details: ${error.message}`;
    }
  }

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    message.textContent = "";
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) {
        const result = await response.json();
        message.textContent = result.error || "Sign out could not be completed.";
        logoutButton.disabled = false;
        return;
      }
      window.location.replace("/");
    } catch (error) {
      message.textContent = `Unable to reach the server: ${error.message}`;
      logoutButton.disabled = false;
    }
  });

  loadCurrentUser();
}());
