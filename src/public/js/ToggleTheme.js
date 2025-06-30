// Theme toggle logic
const themeToggle = document.getElementById("theme-toggle");
const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function setThemeButton() {
  themeToggle.innerHTML = document.body.classList.contains("light-theme")
    ? sunIcon
    : moonIcon;
}

if (themeToggle) {
  // Load saved theme
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
  }
  setThemeButton();
  themeToggle.onclick = () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    // save theme to localstorage
    localStorage.setItem("theme", isLight ? "light" : "dark");
    setThemeButton();
  };
}
