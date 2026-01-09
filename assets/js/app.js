/*
  assets/js/app.js

  What this file does:
  - Loads an external SVG world map into <div id="mapContainer">
  - Makes only selected countries clickable
  - Shows a tooltip (country name) on hover
  - Loads recipes from data/recipes.json
  - Filters by diet (veg/nonveg) + language
  - Renders the first matching recipe in the right panel

  Required files:
  - index.html contains: <div id="mapContainer" class="mapHost"></div>
  - assets/maps/world.svg exists and contains per-country shapes (paths) with IDs
    ideally ISO codes like: US, CA, MX, BR, GB, FR, DE, ES, IT, CH, IN, CN, JP, AU
  - data/recipes.json matches the structure used here (countryCode + type)
*/

const RECIPES_URL = "data/recipes.json";
const WORLD_SVG_URL = "assets/maps/world.svg";

// Only these countries should be interactive
const ACTIVE_CODES = new Set([
  "US", "CH", "CA", "MX", "BR", "GB", "FR", "DE", "ES", "IT", "IN", "CN", "JP", "AU"
]);

// ISO code -> display name for tooltip
const COUNTRY_NAMES = {
  US: "United States",
  CH: "Switzerland",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  GB: "United Kingdom",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  IT: "Italy",
  IN: "India",
  CN: "China",
  JP: "Japan",
  AU: "Australia"
};

// Small UI translations (headings and messages)
const UI_TEXT = {
  en: {
    pickCountry: "Select a country to see a recipe.",
    ingredients: "Ingredients",
    steps: "Steps",
    imageSource: "Image source",
    missing: "No recipe found for this selection."
  },
  de: {
    pickCountry: "Wähle ein Land aus, um ein Rezept zu sehen.",
    ingredients: "Zutaten",
    steps: "Schritte",
    imageSource: "Bildquelle",
    missing: "Kein Rezept für diese Auswahl gefunden."
  },
  fr: {
    pickCountry: "Choisis un pays pour voir une recette.",
    ingredients: "Ingrédients",
    steps: "Étapes",
    imageSource: "Source de l’image",
    missing: "Aucune recette trouvée pour cette sélection."
  },
  it: {
    pickCountry: "Seleziona un paese per vedere una ricetta.",
    ingredients: "Ingredienti",
    steps: "Passaggi",
    imageSource: "Fonte immagine",
    missing: "Nessuna ricetta trovata per questa selezione."
  }
};

let recipesCache = null;

// Tooltip element (created in JS so you do not have to edit HTML again)
let tooltipEl = null;

/* -----------------------------
   Helpers: controls + i18n
------------------------------ */

function getSelectedDiet() {
  const checked = document.querySelector('input[name="diet"]:checked');
  return checked ? checked.value : "veg";
}

function getSelectedLang() {
  const sel = document.getElementById("languageSelect");
  return sel ? sel.value : "en";
}

function tUI(key) {
  const lang = getSelectedLang();
  return (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.en[key] || key;
}

function getLocalizedField(fieldValue) {
  // fieldValue can be a string OR { en: "...", de: "..." }
  const lang = getSelectedLang();
  if (fieldValue && typeof fieldValue === "object") {
    return fieldValue[lang] || fieldValue.en || "";
  }
  return fieldValue || "";
}

function getLocalizedArray(arrValue) {
  // arrValue can be an array OR { en: [..], de: [..] }
  const lang = getSelectedLang();
  if (arrValue && typeof arrValue === "object" && !Array.isArray(arrValue)) {
    return arrValue[lang] || arrValue.en || [];
  }
  return Array.isArray(arrValue) ? arrValue : [];
}

/* -----------------------------
   Recipes loading + rendering
------------------------------ */

async function loadRecipes() {
  if (recipesCache) return recipesCache;

  const res = await fetch(RECIPES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recipes.json");

  // Support both formats:
  // A) { "US": { "veg": [..], "nonveg": [..] }, ... }
  // B) [ { countryCode:"US", type:"veg", ... }, ... ]
  const raw = await res.json();

  recipesCache = normalizeRecipes(raw);
  return recipesCache;
}

function normalizeRecipes(raw) {
  // Format A: object by country
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    const out = [];
    Object.keys(raw).forEach((code) => {
      const byDiet = raw[code];
      if (!byDiet) return;

      ["veg", "nonveg"].forEach((diet) => {
        const list = Array.isArray(byDiet[diet]) ? byDiet[diet] : [];
        list.forEach((r, idx) => {
          out.push({
            id: r.id || `${code}-${diet}-${idx}`,
            countryCode: code,
            type: diet,
            title: r.title,
            description: r.description,
            ingredients: r.ingredients,
            steps: r.steps,
            imageUrl: r.imageUrl,
            imageSourceUrl: r.imageSourceUrl,
            imageSourceName: r.imageSourceName
          });
        });
      });
    });
    return out;
  }

  // Format B: array
  if (Array.isArray(raw)) return raw;

  return [];
}

function renderPlaceholder() {
  const card = document.getElementById("recipeCard");
  if (!card) return;
  card.innerHTML = `<p class="placeholder">${tUI("pickCountry")}</p>`;
}

function renderMissing() {
  const card = document.getElementById("recipeCard");
  if (!card) return;
  card.innerHTML = `<p class="placeholder">${tUI("missing")}</p>`;
}

function renderRecipe(recipe) {
  const card = document.getElementById("recipeCard");
  if (!card) return;

  const title = getLocalizedField(recipe.title);
  const desc = getLocalizedField(recipe.description);
  const ingredients = getLocalizedArray(recipe.ingredients);
  const steps = getLocalizedArray(recipe.steps);

  const ingredientsHtml = ingredients.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const stepsHtml = steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  const imgUrl = recipe.imageUrl || "";
  const srcUrl = recipe.imageSourceUrl || recipe.imageUrl || "#";
  const srcName = recipe.imageSourceName || "Source";

  const imgBlock = imgUrl
    ? `
      <img class="recipe-image" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)}" loading="lazy" />
      <p class="image-credit">
        ${tUI("imageSource")}: <a href="${escapeHtml(srcUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(srcName)}</a>
      </p>
    `
    : "";

  card.innerHTML = `
    <h2 class="recipe-title">${escapeHtml(title)}</h2>
    <p class="recipe-desc">${escapeHtml(desc)}</p>

    ${imgBlock}

    <div class="recipe-section">
      <h3>${tUI("ingredients")}</h3>
      <ul>${ingredientsHtml}</ul>
    </div>

    <div class="recipe-section">
      <h3>${tUI("steps")}</h3>
      <ol>${stepsHtml}</ol>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------------
   Map loading + interactivity
------------------------------ */

async function loadWorldSvg() {
  const res = await fetch(WORLD_SVG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load world.svg");

  const svgText = await res.text();

  const container = document.getElementById("mapContainer");
  if (!container) throw new Error('Missing <div id="mapContainer"> in index.html');

  container.innerHTML = svgText;

  // Find the inserted SVG
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("world.svg did not contain an <svg> element");

  svg.setAttribute("id", "worldMap");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "World map with clickable countries");

  setupTooltip();
  setupCountryInteractivity(svg);
}

function setupCountryInteractivity(svg) {
  // This selector is intentionally broad:
  // Many world SVGs use <path>, <g>, or <polygon> for countries.
  // Most importantly, they have an id or a data attribute.
  const candidates = Array.from(svg.querySelectorAll("[id]"));

  candidates.forEach((el) => {
    const code = (el.id || "").trim();

    // Some SVGs include many non-country IDs; we only activate our list.
    if (!ACTIVE_CODES.has(code)) return;

    el.classList.add("country");
    el.dataset.code = code;
    el.dataset.name = COUNTRY_NAMES[code] || code;

    // Add native SVG tooltip support too
    addSvgTitle(el, el.dataset.name);

    // Click and hover handlers
    el.addEventListener("click", () => handleCountrySelect(el));
    el.addEventListener("mouseenter", () => showTooltip(el));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("mousemove", moveTooltip);

    // Keyboard accessibility if the element supports it
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCountrySelect(el);
      }
    });
  });
}

function addSvgTitle(el, text) {
  const ns = "http://www.w3.org/2000/svg";
  let titleEl = el.querySelector("title");
  if (!titleEl) {
    titleEl = document.createElementNS(ns, "title");
    el.prepend(titleEl);
  }
  titleEl.textContent = text;
}

function clearSelectedCountries() {
  document.querySelectorAll("#mapContainer .country.is-selected").forEach((el) => {
    el.classList.remove("is-selected");
  });
}

async function handleCountrySelect(countryEl) {
  const code = countryEl.dataset.code;
  if (!code) return;

  clearSelectedCountries();
  countryEl.classList.add("is-selected");

  const diet = getSelectedDiet();
  const recipes = await loadRecipes();

  // Pick the first recipe matching country + diet
  const match = recipes.find((r) => r.countryCode === code && r.type === diet);

  if (!match) {
    renderMissing();
    return;
  }

  renderRecipe(match);
}

/* -----------------------------
   Tooltip (country name on hover)
------------------------------ */

function setupTooltip() {
  if (tooltipEl) return;

  tooltipEl = document.createElement("div");
  tooltipEl.id = "tooltip";
  tooltipEl.hidden = true;

  // Inline styles so you do not have to edit CSS,
  // but you can move this to styles.css if you prefer.
  tooltipEl.style.position = "fixed";
  tooltipEl.style.zIndex = "9999";
  tooltipEl.style.background = "rgba(10, 15, 30, 0.95)";
  tooltipEl.style.color = "white";
  tooltipEl.style.border = "1px solid rgba(255,255,255,0.15)";
  tooltipEl.style.padding = "6px 10px";
  tooltipEl.style.borderRadius = "10px";
  tooltipEl.style.fontSize = "12px";
  tooltipEl.style.pointerEvents = "none";

  document.body.appendChild(tooltipEl);
}

function showTooltip(countryEl) {
  if (!tooltipEl) return;
  tooltipEl.textContent = countryEl.dataset.name || countryEl.dataset.code || "";
  tooltipEl.hidden = false;
}

function moveTooltip(e) {
  if (!tooltipEl) return;
  tooltipEl.style.left = `${e.clientX + 12}px`;
  tooltipEl.style.top = `${e.clientY + 12}px`;
}

function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.hidden = true;
}

/* -----------------------------
   Controls rerender behavior
------------------------------ */

function attachControlHandlers() {
  // When diet changes, re-render current selection
  document.querySelectorAll('input[name="diet"]').forEach((el) => {
    el.addEventListener("change", () => rerenderSelectedCountry());
  });

  // When language changes, re-render recipe text
  const langSel = document.getElementById("languageSelect");
  if (langSel) {
    langSel.addEventListener("change", () => rerenderSelectedCountry());
  }
}

async function rerenderSelectedCountry() {
  const selected = document.querySelector("#mapContainer .country.is-selected");
  if (!selected) {
    renderPlaceholder();
    return;
  }
  await handleCountrySelect(selected);
}

/* -----------------------------
   Init
------------------------------ */

async function init() {
  renderPlaceholder();
  attachControlHandlers();

  try {
    // Load SVG first so map is visible
    await loadWorldSvg();

    // Preload recipes so clicks feel instant
    await loadRecipes();
  } catch (err) {
    console.error(err);
    const card = document.getElementById("recipeCard");
    if (card) card.innerHTML = `<p class="placeholder">Error: ${escapeHtml(err.message || String(err))}</p>`;
  }
}

init();
