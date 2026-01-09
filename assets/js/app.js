/*
  app.js
  - Loads recipes.json once
  - Handles country clicks
  - Applies veg/nonveg + language filters
*/

const RECIPES_URL = "data/recipes.json";

let recipesByCountry = null;

// Simple UI translations for headings and messages
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
  // fieldValue can be a string OR an object like { en: "...", de: "..." }
  const lang = getSelectedLang();
  if (fieldValue && typeof fieldValue === "object") {
    return fieldValue[lang] || fieldValue.en || "";
  }
  return fieldValue || "";
}

function getLocalizedArray(arrValue) {
  // arrValue can be an array OR an object like { en: [..], de: [..] }
  const lang = getSelectedLang();
  if (arrValue && typeof arrValue === "object" && !Array.isArray(arrValue)) {
    return arrValue[lang] || arrValue.en || [];
  }
  return Array.isArray(arrValue) ? arrValue : [];
}

async function loadRecipes() {
  if (recipesByCountry) return recipesByCountry;

  const res = await fetch(RECIPES_URL);
  if (!res.ok) throw new Error("Failed to load recipes.json");

  recipesByCountry = await res.json();
  return recipesByCountry;
}

function clearSelectedCountries() {
  document.querySelectorAll(".country.is-selected").forEach((el) => {
    el.classList.remove("is-selected");
  });
}

function renderPlaceholder() {
  const card = document.getElementById("recipeCard");
  card.innerHTML = `<p class="placeholder">${tUI("pickCountry")}</p>`;
}

function renderMissing() {
  const card = document.getElementById("recipeCard");
  card.innerHTML = `<p class="placeholder">${tUI("missing")}</p>`;
}

function renderRecipe(recipe) {
  const card = document.getElementById("recipeCard");

  const title = getLocalizedField(recipe.title);
  const desc = getLocalizedField(recipe.description);
  const ingredients = getLocalizedArray(recipe.ingredients);
  const steps = getLocalizedArray(recipe.steps);

  const ingredientsHtml = ingredients.map((i) => `<li>${i}</li>`).join("");
  const stepsHtml = steps.map((s) => `<li>${s}</li>`).join("");

  const imgUrl = recipe.imageUrl;
  const srcUrl = recipe.imageSourceUrl;
  const srcName = recipe.imageSourceName || "Source";

  card.innerHTML = `
    <h2 class="recipe-title">${title}</h2>
    <p class="recipe-desc">${desc}</p>

    <img class="recipe-image" src="${imgUrl}" alt="${title}" loading="lazy" />
    <p class="image-credit">
      ${tUI("imageSource")}: <a href="${srcUrl}" target="_blank" rel="noopener noreferrer">${srcName}</a>
    </p>

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

async function handleCountryClick(countryEl) {
  const code = countryEl.getAttribute("data-code");
  if (!code) return;

  clearSelectedCountries();
  countryEl.classList.add("is-selected");

  const diet = getSelectedDiet(); // "veg" or "nonveg"
  const data = await loadRecipes();

  const countryData = data[code];
  if (!countryData || !countryData[diet] || countryData[diet].length === 0) {
    renderMissing();
    return;
  }

  // For now, pick the first matching recipe
  renderRecipe(countryData[diet][0]);
}

function attachMapHandlers() {
  document.querySelectorAll(".country").forEach((el) => {
    el.addEventListener("click", () => handleCountryClick(el));
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");

    // Keyboard accessibility
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCountryClick(el);
      }
    });
  });
}

function attachControlHandlers() {
  // When diet or language changes, re-render current selection (if any)
  document.querySelectorAll('input[name="diet"]').forEach((el) => {
    el.addEventListener("change", () => rerenderSelectedCountry());
  });

  const langSel = document.getElementById("languageSelect");
  langSel.addEventListener("change", () => rerenderSelectedCountry());
}

async function rerenderSelectedCountry() {
  const selected = document.querySelector(".country.is-selected");
  if (!selected) {
    renderPlaceholder();
    return;
  }
  await handleCountryClick(selected);
}

async function init() {
  renderPlaceholder();
  attachMapHandlers();
  attachControlHandlers();

  // Preload recipes so first click feels instant
  try {
    await loadRecipes();
  } catch (err) {
    console.error(err);
  }
}

init();
