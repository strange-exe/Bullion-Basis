// Applies the viewer's saved theme before first paint (external file so the CSP needs no inline script).
try { if (localStorage.getItem("gsl-theme") === "light") document.documentElement.dataset.theme = "light"; } catch (e) { /* storage blocked */ }
