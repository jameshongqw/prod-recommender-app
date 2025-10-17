// Constants & Configs
const API_BASE_URL = "http://localhost:3000/api";

// UI Utilities
const UI = {
  showMessage(message, type = "error") {
    const existingMsg = document.querySelector(".temp-msg");
    if (existingMsg) {
      existingMsg.remove();
    }
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
  showLoading() {
    const placeholder = document.querySelector(".output-tab__placeholder");
    const loading = document.querySelector(".output-tab__loading");
    const results = document.querySelector(".output-tab__results");

    placeholder?.classList.remove("active");
    results?.classList.remove("active");
    loading?.classList.add("active");
  },
  hideLoading() {
    const loading = document.querySelector(".output-tab__loading");
    loading?.classList.remove("active");
  },
  showPlaceholder(
    message = "Enter user profile to get personalized recommendations"
  ) {
    const placeholder = document.querySelector(".output-tab__placeholder");
    if (placeholder) {
      placeholder.classList.add("active");
      const p = placeholder.querySelector("p");
      if (p) p.textContent = message;
    }
  },
  hidePlaceholder() {
    const placeholder = document.querySelector(".output-tab__placeholder");
    placeholder?.classList.remove("active");
  },
};

// Authentication
const Auth = {
  checkAuth() {
    const userId = localStorage.getItem("userId");
    const userName = localStorage.getItem("userName");

    if (!userId || !userName) {
      window.location.href = "authenticate.html";
      return false;
    }
    return true;
  },
  logout() {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    window.location.href = "authenticate.html";
  },
  getUserId() {
    return localStorage.getItem("userId");
  },
  getUserName() {
    return localStorage.getItem("userName");
  },
};

(function checkAuthImmediate() {
  const userId = localStorage.getItem("userId");
  const userName = localStorage.getItem("userName");

  if (!userId || !userName) {
    window.location.href = "authenticate.html";
  }
})();

// API
const API = {
  async loadUserProfile(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${userId}`);

      if (response.ok) {
        return await response.json();
      } else if (response.status === 404) {
        return null;
      } else {
        throw new Error("Failed to load profile");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      throw error;
    }
  },
  async saveUserProfile(userId, profileData) {
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gender: parseInt(profileData.gender),
          ageGroup: parseInt(profileData.ageGroup),
          shoppingLevel: parseInt(profileData.shoppingLevel),
          isStudent: parseInt(profileData.isStudent),
          hourOfClick: parseInt(profileData.hourOfClick),
          dayOfClick: parseInt(profileData.dayOfClick),
        }),
      });
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error;
    }
  },
  async getRecommendations(profileData, model) {
    try {
      const response = await fetch(`${API_BASE_URL}/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gender: parseInt(profileData.gender),
          ageGroup: parseInt(profileData.ageGroup),
          shoppingLevel: parseInt(profileData.shoppingLevel),
          isStudent: parseInt(profileData.isStudent),
          hourOfClick: parseInt(profileData.hourOfClick),
          dayOfClick: parseInt(profileData.dayOfClick),
          model: model,
        }),
      });
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error("Failed to get recommendations");
      }
    } catch (error) {
      console.error("Error getting recommendations:", error);
      throw error;
    }
  },
};

// Profile Management
const ProfileManager = {
  async load() {
    const userId = Auth.getUserId();
    if (!userId) return;

    try {
      const profile = await API.loadUserProfile(userId);

      if (profile && profile.gender !== null) {
        this.populateForm(profile);
        this.updateSaveButtonText("Update Profile");
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  },

  populateForm(profile) {
    const form = document.getElementById("userProfileForm");
    if (!form) return;

    const fields = {
      gender: profile.gender,
      ageGroup: profile.ageGroup,
      shoppingLevel: profile.shoppingLevel,
      isStudent: profile.isStudent,
      hourOfClick: profile.hourOfClick,
      dayOfClick: profile.dayOfClick,
    };

    Object.entries(fields).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element && value !== null && value !== undefined) {
        element.value = value;
      }
    });
  },

  getFormData() {
    const form = document.getElementById("userProfileForm");
    if (!form) return null;

    return {
      gender: form.gender.value,
      ageGroup: form.ageGroup.value,
      shoppingLevel: form.shoppingLevel.value,
      isStudent: form.isStudent.value,
      hourOfClick: form.hourOfClick.value,
      dayOfClick: form.dayOfClick.value,
    };
  },

  updateSaveButtonText(text) {
    const saveBtn = document.querySelector(
      ".input-tab__form__save-profile-btn"
    );
    if (saveBtn) {
      saveBtn.textContent = text;
    }
  },

  async save() {
    const form = document.getElementById("userProfileForm");
    if (!form || !form.checkValidity()) {
      form?.reportValidity();
      return false;
    }

    const formData = this.getFormData();
    const userId = Auth.getUserId();

    try {
      await API.saveUserProfile(userId, formData);
      UI.showMessage("Profile saved successfully!", "success");
      this.updateSaveButtonText("Update Profile");
      return true;
    } catch (error) {
      UI.showMessage(error.message || "Failed to save profile", "error");
      return false;
    }
  },
};

// Recommendation
const Recommendations = {
  display(data) {
    UI.hideLoading();
    UI.hidePlaceholder();

    if (
      !data.success ||
      !data.recommendations ||
      data.recommendations.length === 0
    ) {
      UI.showPlaceholder("No recommendations found. Please try again.");
      return;
    }

    const resultsContainer = document.querySelector(".output-tab__results");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";

    data.recommendations.forEach((rec) => {
      const card = this.createRecommendationCard(rec);
      resultsContainer.appendChild(card);
    });

    resultsContainer.classList.add("active");
  },

  createRecommendationCard(rec) {
    const card = document.createElement("div");
    card.className = "output-tab__results__card";

    const brandDisplay = rec.brandName || `Brand ID: ${rec.brandId}`;
    const categoryDisplay =
      rec.categoryName || `Category ID: ${rec.categoryId}`;

    card.innerHTML = `
      <div class="output-tab__results__card__rank-wrapper">
        <p>${rec.rank}</p>
      </div>
      <div class="output-tab__results__card__info">
        <p class="output-tab__results__card__brand">${brandDisplay}</p>
        <p class="output-tab__results__card__category">${categoryDisplay}</p>
      </div>
      <p class="output-tab__results__card__price">¥${rec.price.toFixed(2)}</p>
    `;

    return card;
  },

  async fetch() {
    const form = document.getElementById("userProfileForm");
    const modelSelect = document.getElementById("model");

    if (!modelSelect?.value) {
      UI.showMessage("Please select a model type first", "error");
      modelSelect?.focus();
      return;
    }

    if (!form || !form.checkValidity()) {
      form?.reportValidity();
      return;
    }

    UI.showLoading();

    const formData = ProfileManager.getFormData();
    const useGenModel = modelSelect.value === "gen";

    try {
      const data = await API.getRecommendations(formData, useGenModel);

      setTimeout(() => {
        this.display(data);
      }, 1000);
    } catch (error) {
      UI.hideLoading();
      UI.showPlaceholder("Failed to get recommendations. Please try again.");
      UI.showMessage("Failed to get recommendations", "error");
    }
  },
};

// Event Handling
const EventHandlers = {
  initLogout() {
    const logoutBtn = document.querySelector(".intro__logout-btn");
    logoutBtn?.addEventListener("click", () => Auth.logout());
  },

  initSaveProfile() {
    const saveBtn = document.querySelector(
      ".input-tab__form__save-profile-btn"
    );
    saveBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      await ProfileManager.save();
    });
  },

  initGetRecommendations() {
    const recommendBtn = document.querySelector(
      ".input-tab__form__recommend-btn"
    );
    recommendBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      await Recommendations.fetch();
    });
  },
};

// App Initialization
const App = {
  async init() {
    // Check authentication immediately
    if (!Auth.checkAuth()) {
      return;
    }

    // Display welcome message
    const userName = Auth.getUserName();
    const titleElement = document.querySelector(".intro__title");
    if (titleElement) {
      titleElement.textContent = `Welcome back, ${userName}!`;
    }

    // Load saved profile
    await ProfileManager.load();

    // Initialize event handlers
    EventHandlers.initLogout();
    EventHandlers.initSaveProfile();
    EventHandlers.initGetRecommendations();
  },
};

// Start App
document.addEventListener("DOMContentLoaded", () => App.init());
