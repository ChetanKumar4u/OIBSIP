(function () {
  "use strict";

  const loginPanel = document.getElementById("login-panel");
  const registerPanel = document.getElementById("register-panel");
  const message = document.getElementById("form-message");
  const tabs = document.querySelectorAll("[data-mode]");

  function setMode(mode) {
    const isLogin = mode === "login";
    loginPanel.hidden = !isLogin;
    registerPanel.hidden = isLogin;
    document.getElementById("login-tab").classList.toggle("active", isLogin);
    document.getElementById("register-tab").classList.toggle("active", !isLogin);
    document.getElementById("login-tab").setAttribute("aria-selected", String(isLogin));
    document.getElementById("register-tab").setAttribute("aria-selected", String(!isLogin));
    message.textContent = "";
  }

  async function submitForm(form, endpoint) {
    message.textContent = "";
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = response.status === 204 ? {} : await response.json();
      if (!response.ok) {
        message.textContent = result.error || "The request could not be completed.";
        return;
      }
      window.location.assign("/dashboard");
    } catch (error) {
      message.textContent = `Unable to reach the server: ${error.message}`;
    } finally {
      submitButton.disabled = false;
    }
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
  document.getElementById("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitForm(event.currentTarget, "/api/login");
  });
  document.getElementById("register-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitForm(event.currentTarget, "/api/register");
  });
}());
