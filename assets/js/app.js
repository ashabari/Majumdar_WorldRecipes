/*
  assets/js/app.js

  - Loads external SVG into #mapContainer
  - Makes only selected countries clickable
  - Shows tooltip (country name) on hover
  - Loads recipes from data/recipes.json
  - Filters by diet + language
  - Renders the first matching recipe
*/

const RECIPES_URL = "data/recipes.json";
const WORLD_SVG_URL = "assets/world.svg"; // <-- FIXED to match your file location

const ACTIVE_CODES = new Set([
  "US", "CH", "CA", "MX", "BR", "GB", "FR", "DE", "ES", "IT", "IN", "CN", "JP", "AU"
]);

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
let tooltipEl = null;

/* Helpers */

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
  const lang = getSelectedLang();
  if (fieldValue && typeof fieldValue === "object") {
    return fieldValue[lang] || fieldValue.en || "";
  }
  return fieldValue || "";
}

function getLocalizedArray(arrValue) {
  const lang = getSelectedLang();
  if (arrValue && typeof arrValue === "object" && !Array.isArray(arrValue)) {
    return arrValue[lang] || arrValue.en || [];
  }
  return Array.isArray(arrValue) ? arrValue : [];
}

/* Recipes loading + rendering */

async function loadRecipes() {
  if (recipesCache) return recipesCache;

  const res = await fetch(RECIPES_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load recipes.json");

  const raw = await res.json();
  recipesCache = normalizeRecipes(raw);
  return recipesCache;
}

function normalizeRecipes(raw) {
  // Format A: { "US": { "veg": [..], "nonveg": [..] } }
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

  // Format B: [ { countryCode:"US", type:"veg", ... } ]
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

/* Map loading + interactivity */

async function loadWorldSvg() {
  const res = await fetch(WORLD_SVG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load world.svg at ${WORLD_SVG_URL}`);

  const svgText = await res.text();

  const container = document.getElementById("mapContainer");
  if (!container) throw new Error('Missing <div id="mapContainer"> in index.html');

  container.innerHTML = svgText;

  const svg = container.querySelector("svg");
  if (!svg) throw new Error("world.svg did not contain an <svg> element");

  svg.setAttribute("id", "worldMap");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "World map with clickable countries");

  setupTooltip();
  setupCountryInteractivity(svg);
  attachMapZoomControls();
}

function setupCountryInteractivity(svg) {
  const candidates = Array.from(svg.querySelectorAll("[id]"));

  candidates.forEach((el) => {
    const code = (el.id || "").trim();

    if (!ACTIVE_CODES.has(code)) return;

    el.classList.add("country");
    el.dataset.code = code;
    el.dataset.name = COUNTRY_NAMES[code] || code;

    addSvgTitle(el, el.dataset.name);

    el.addEventListener("click", () => handleCountrySelect(el));
    el.addEventListener("mouseenter", () => showTooltip(el));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("mousemove", moveTooltip);

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

  const match = recipes.find((r) => r.countryCode === code && r.type === diet);

  if (!match) {
    renderMissing();
    return;
  }

  renderRecipe(match);
}

/* Tooltip */

function setupTooltip() {
  if (tooltipEl) return;

  tooltipEl = document.createElement("div");
  tooltipEl.id = "tooltip";
  tooltipEl.hidden = true;

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

/* Controls rerender behavior */

function attachControlHandlers() {
  document.querySelectorAll('input[name="diet"]').forEach((el) => {
    el.addEventListener("change", () => rerenderSelectedCountry());
  });

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

function attachCustomRecipeHandlers() {
  const toggleBtn = document.getElementById("customToggleBtn");
  const form = document.getElementById("customForm");
  const clearBtn = document.getElementById("customClearBtn");

  if (!toggleBtn || !form) return;

  toggleBtn.addEventListener("click", () => {
    form.hidden = !form.hidden;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const recipe = generateCustomRecipeFromForm();
    renderRecipe(recipe);
    clearSelectedCountries();
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const ing = document.getElementById("customIngredients");
      if (ing) ing.value = "";
      renderPlaceholder();
      clearSelectedCountries();
    });
  }
}

function generateCustomRecipeFromForm() {
  const ingredientsText = (document.getElementById("customIngredients")?.value || "").trim();
  const diet = document.getElementById("customDiet")?.value || "veg";
  const style = document.getElementById("customStyle")?.value || "auto";
  const spice = document.getElementById("customSpice")?.value || "mild";

  const ingredients = parseIngredients(ingredientsText);
  const resolvedStyle = style === "auto" ? chooseStyle(ingredients) : style;

  const { title, description, steps } = buildRecipe(resolvedStyle, ingredients, diet, spice);

  return {
    id: `custom-${Date.now()}`,
    countryCode: "CUSTOM",
    type: diet,
    title: { en: title, de: title, fr: title, it: title },
    description: { en: description, de: description, fr: description, it: description },
    ingredients: {
      en: ingredients.map(capitalize),
      de: ingredients.map(capitalize),
      fr: ingredients.map(capitalize),
      it: ingredients.map(capitalize)
    },
    steps: {
      en: steps,
      de: steps,
      fr: steps,
      it: steps
    },
    imageUrl: "",
    imageSourceUrl: "",
    imageSourceName: ""
  };
}

function parseIngredients(text) {
  if (!text) return [];
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 18);
}

function chooseStyle(ingredients) {
  const has = (k) => ingredients.some((i) => i.toLowerCase().includes(k));

  if (has("pasta") || has("spaghetti") || has("penne") || has("noodle")) return "pasta";
  if (has("lettuce") || has("spinach") || has("cucumber")) return "salad";
  if (has("broth") || has("stock") || has("lentil")) return "soup";
  if (has("tortilla") || has("wrap") || has("bread")) return "wrap";
  if (has("curry") || has("garam") || has("coconut")) return "curry";
  return "stirfry";
}

function buildRecipe(style, ingredients, diet, spice) {
  const spiceNote =
    spice === "hot" ? "Make it spicy with chili or hot sauce." :
    spice === "medium" ? "Add a little chili for a kick." :
    "Keep spices gentle.";

  const proteinHint = diet === "nonveg"
    ? "Add a protein like chicken, eggs, or fish if you have it."
    : "Add chickpeas, tofu, beans, or paneer for protein.";

  const baseTitle = styleName(style);
  const main = ingredients[0] ? capitalize(ingredients[0]) : "Your ingredients";

  const title = `${baseTitle} with ${main}`;
  const description = `A quick ${styleName(style).toLowerCase()} built from what you have. ${spiceNote}`;

  const core = ingredients.length ? ingredients : ["oil", "salt", "pepper", "onion"];

  const stepsByStyle = {
    stirfry: [
      "Prep ingredients: chop, slice, and pat dry anything wet.",
      "Heat a pan with oil. Cook aromatics first (onion, garlic, ginger).",
      `Add the rest: ${listFew(core)}. Stir-fry until cooked.`,
      "Season with salt, pepper, and optional soy or lemon.",
      proteinHint,
      "Serve hot. Finish with herbs or a squeeze of lime."
    ],
    curry: [
      "Saute onion, garlic, and spices in oil until fragrant.",
      `Add: ${listFew(core)} and stir to coat.`,
      "Pour in water or coconut milk and simmer 10 to 15 minutes.",
      proteinHint,
      "Adjust salt, add chili if desired, and finish with cilantro.",
      "Serve with rice, bread, or noodles."
    ],
    pasta: [
      "Boil salted water and cook pasta until al dente.",
      "Saute aromatics in oil. Add chopped vegetables and cook until tender.",
      `Stir in: ${listFew(core)} and a splash of pasta water to make a sauce.`,
      proteinHint,
      "Toss pasta with sauce. Taste and adjust salt and pepper.",
      "Top with cheese or herbs if you like."
    ],
    salad: [
      "Wash and chop fresh ingredients.",
      `Combine: ${listFew(core)} in a bowl.`,
      "Make a dressing: olive oil + lemon (or vinegar) + salt + pepper.",
      proteinHint,
      "Toss, taste, and adjust seasoning.",
      "Serve immediately."
    ],
    soup: [
      "Saute onion, garlic, and spices in a pot.",
      `Add: ${listFew(core)} and stir for 1 minute.`,
      "Add broth or water. Simmer until everything is tender.",
      proteinHint,
      "Blend partially for thickness if you want.",
      "Taste, adjust salt, and serve warm."
    ],
    wrap: [
      "Warm your wrap or bread lightly.",
      "Cook a quick filling in a pan with oil and aromatics.",
      `Use: ${listFew(core)} for the filling.`,
      proteinHint,
      "Add a sauce: yogurt, mayo, or a simple lemon dressing.",
      "Wrap tightly and serve."
    ]
  };

  const steps = stepsByStyle[style] || stepsByStyle.stirfry;

  return { title, description, steps };
}

function styleName(style) {
  const names = {
    stirfry: "Stir-fry",
    curry: "Curry",
    pasta: "Pasta",
    salad: "Salad",
    soup: "Soup",
    wrap: "Wrap"
  };
  return names[style] || "Recipe";
}

function listFew(items) {
  const nice = items.map((s) => s.trim()).filter(Boolean);
  return nice.slice(0, 6).join(", ") + (nice.length > 6 ? " and more" : "");
}

function capitalize(s) {
  const str = String(s || "").trim();
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function attachMapZoomControls() {
  const container = document.getElementById("mapContainer");
  if (!container) return;

  const svg = container.querySelector("svg");
  if (!svg) return;

  const zoomInBtn = document.getElementById("zoomInBtn");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomResetBtn = document.getElementById("zoomResetBtn");

  let scale = 1;

  function applyZoom() {
    svg.style.transformOrigin = "0 0";
    svg.style.transform = `scale(${scale})`;
  }

  zoomInBtn?.addEventListener("click", () => {
    scale = Math.min(3, scale + 0.25);
    applyZoom();
  });

  zoomOutBtn?.addEventListener("click", () => {
    scale = Math.max(1, scale - 0.25);
    applyZoom();
  });

  zoomResetBtn?.addEventListener("click", () => {
    scale = 1;
    applyZoom();
    container.scrollTop = 0;
    container.scrollLeft = 0;
  });
}

/* Init */

async function init() {
  renderPlaceholder();
  attachControlHandlers();
  attachCustomRecipeHandlers();

  try {
    await loadWorldSvg();
    await loadRecipes();
  } catch (err) {
    console.error(err);
    const card = document.getElementById("recipeCard");
    if (card) {
      card.innerHTML = `<p class="placeholder">Error: ${escapeHtml(err.message || String(err))}</p>`;
    }
  }
}

init();
