const root = document.documentElement;
const key = "theme-preference";

function applyTheme(theme){
  if(theme === "light") root.classList.add("light");
  else root.classList.remove("light");
  localStorage.setItem(key, theme);
}

applyTheme(localStorage.getItem(key) || "dark");

document.getElementById("themeToggle")?.addEventListener("click", () => {
  const isLight = root.classList.contains("light");
  applyTheme(isLight ? "dark" : "light");
});

document.getElementById("year").textContent = new Date().getFullYear();
