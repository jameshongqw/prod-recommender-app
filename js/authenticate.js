// Constants & Configs
const API_BASE_URL = "http://localhost:3000/api";

// UI Utilities
const UI = {
  showMessage(message, type = "error") {
    const existingMsg = document.querySelector(".temp-msg");
    if (existingMsg) existingMsg.remove();

    const msgDiv = document.createElement("div");
    msgDiv.className = `temp-msg ${type}`;
    msgDiv.innerHTML = `<p>${message}</p>`;
    document.body.appendChild(msgDiv);

    setTimeout(() => msgDiv.classList.add("active"), 10);
    setTimeout(() => {
      msgDiv.classList.remove("active");
      setTimeout(() => msgDiv.remove(), 300);
    }, 3000);
  },
};
// Validation Helpers
const Validators = {
  sanitize(input) {
    return input.trim();
  },
  isEmpty(value) {
    return !value || value.trim() === "";
  },
  email(email) {
    if (this.isEmpty(email))
      return { valid: false, message: "Email is required" };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email)
      ? { valid: true }
      : { valid: false, message: "Please enter a valid email address" };
  },
  password(password, { strict = true } = {}) {
    if (this.isEmpty(password))
      return { valid: false, message: "Password is required" };
    if (!strict) return { valid: true };

    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNum = /[0-9]/.test(password);

    if (!minLength)
      return {
        valid: false,
        message: "Password must be at least 8 characters",
      };
    if (!hasUpper)
      return {
        valid: false,
        message: "Password must contain an uppercase letter",
      };
    if (!hasLower)
      return {
        valid: false,
        message: "Password must contain a lowercase letter",
      };
    if (!hasNum)
      return { valid: false, message: "Password must contain a number" };
    return { valid: true };
  },
  name(name) {
    if (this.isEmpty(name))
      return { valid: false, message: "Name is required" };
    const nameRegex = /^[a-zA-Z\s-]{2,50}$/;
    return nameRegex.test(name)
      ? { valid: true }
      : {
          valid: false,
          message:
            "Name must be 2-50 characters and contain only letters, spaces, or hyphens",
        };
  },
};

// Login and signup tab switching
const Tabs = {
  els: {
    loginTab: document.querySelector(".auth-tabs__login"),
    signupTab: document.querySelector(".auth-tabs__sign-up"),
    loginForm: document.querySelector(".auth-content__login-form"),
    signupForm: document.querySelector(".auth-content__signup-form"),
  },

  switchTo(view) {
    const { loginTab, signupTab, loginForm, signupForm } = this.els;
    const isLogin = view === "login";

    loginTab?.classList.toggle("active", isLogin);
    signupTab?.classList.toggle("active", !isLogin);
    loginForm?.classList.toggle("active", isLogin);
    signupForm?.classList.toggle("active", !isLogin);
  },

  init() {
    const { loginTab, signupTab } = this.els;
    loginTab?.addEventListener("click", () => this.switchTo("login"));
    signupTab?.addEventListener("click", () => this.switchTo("signup"));
  },
};

// Password visibility toggle
const PasswordToggle = {
  init() {
    document.querySelectorAll(".fa-eye, .fa-eye-slash").forEach((icon) => {
      icon.addEventListener("click", function () {
        const input = this.parentElement.querySelector("input");
        if (!input) return;
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        this.classList.toggle("fa-eye", !isPassword);
        this.classList.toggle("fa-eye-slash", isPassword);
      });
    });
  },
};

// Auth API
const AuthAPI = {
  async signup({ name, email, password }) {
    const res = await fetch(`${API_BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Sign up failed");
    return data;
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Login failed");
    return data;
  },
};

// Auth form handling
const AuthFlow = {
  els: {
    signupForm: document.querySelector(".auth-content__signup-form"),
    loginForm: document.querySelector(".auth-content__login-form"),
  },

  disable(form, disabled) {
    form
      ?.querySelectorAll("input, button")
      .forEach((el) => (el.disabled = !!disabled));
  },

  async handleSignup(e) {
    e.preventDefault();
    const form = e.currentTarget;

    const name = Validators.sanitize(
      document.getElementById("registerName")?.value || ""
    );
    const email = Validators.sanitize(
      document.getElementById("registerEmail")?.value || ""
    );
    const password = document.getElementById("registerPassword")?.value || "";
    const confirmPassword =
      document.getElementById("confirmPassword")?.value || "";

    const nameCheck = Validators.name(name);
    if (!nameCheck.valid) return UI.showMessage(nameCheck.message, "error");

    const emailCheck = Validators.email(email);
    if (!emailCheck.valid) return UI.showMessage(emailCheck.message, "error");

    const pwCheck = Validators.password(password, { strict: true });
    if (!pwCheck.valid) return UI.showMessage(pwCheck.message, "error");

    if (Validators.isEmpty(confirmPassword)) {
      return UI.showMessage("Please confirm your password", "error");
    }
    if (password !== confirmPassword) {
      return UI.showMessage("Passwords do not match!", "error");
    }

    try {
      this.disable(form, true);
      await AuthAPI.signup({ name, email, password });
      UI.showMessage("Account created successfully!", "success");
      form.reset();
      setTimeout(() => Tabs.switchTo("login"), 1200);
    } catch (err) {
      UI.showMessage(err.message || "Sign up failed", "error");
    } finally {
      this.disable(form, false);
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const form = e.currentTarget;

    const email = Validators.sanitize(
      document.getElementById("loginEmail")?.value || ""
    );
    const password = document.getElementById("loginPassword")?.value || "";

    const emailCheck = Validators.email(email);
    if (!emailCheck.valid) return UI.showMessage(emailCheck.message, "error");

    const pwCheck = Validators.password(password, { strict: false });
    if (!pwCheck.valid) return UI.showMessage(pwCheck.message, "error");

    try {
      this.disable(form, true);
      const data = await AuthAPI.login({ email, password });

      // Persist session to localStorage (aligned with index.js expectations)
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("userName", data.name);

      UI.showMessage("Login successful! Redirecting...", "success");
      setTimeout(() => (window.location.href = "index.html"), 1200);
    } catch (err) {
      UI.showMessage(err.message || "Login failed", "error");
    } finally {
      this.disable(form, false);
    }
  },

  init() {
    const { signupForm, loginForm } = this.els;
    signupForm?.addEventListener("submit", this.handleSignup.bind(this));
    loginForm?.addEventListener("submit", this.handleLogin.bind(this));
  },
};

// App Initialization
const App = {
  init() {
    Tabs.init();
    PasswordToggle.init();
    AuthFlow.init();
  },
};

// Start App
document.addEventListener("DOMContentLoaded", () => App.init());
