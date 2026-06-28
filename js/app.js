import { bodyWeightStore, EXERCISE_CATEGORIES, exerciseStore, findExerciseMatches, normalizeExerciseName, planStore, workoutStore } from "./data-store.js";
import { isRememberSessionEnabled, setRememberSession } from "./auth-storage.js";
import { isSupabaseConfigured, supabase, supabaseInitializationError } from "./supabase-client.js";
import { buildWeeklyReport } from "./report-utils.js";
import { exerciseExecutions, exerciseProgressSummary, loadProgressionPoints, trackedExercisesFromHistory } from "./exercise-progress-utils.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const installButton = document.querySelector("#install-button");
const logoutButton = document.querySelector("#logout-button");
const userBadge = document.querySelector("#user-badge");
let currentUser = null;
let deferredInstallPrompt;
const ACTIVE_WORKOUT_KEY = "gymboard-active-workout-v1";

function getActiveWorkout() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY)); } catch { return null; }
}

function saveActiveWorkout(draft) {
  localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
}

function clearActiveWorkout() {
  localStorage.removeItem(ACTIVE_WORKOUT_KEY);
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (date, options) =>
  new Intl.DateTimeFormat("it-IT", options).format(new Date(date));
const formatNumber = (number) =>
  new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(number);

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function displayName() {
  return currentUser?.user_metadata?.full_name?.trim()
    || currentUser?.user_metadata?.display_name?.trim()
    || localStorage.getItem("gymboard-display-name")
    || "Utente";
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function showLoading() {
  app.innerHTML = '<div class="loading-state"><span class="loader" aria-hidden="true"></span><p>Caricamento...</p></div>';
}

function showDataError(error) {
  console.error(error);
  app.innerHTML = `
    <section class="empty-state data-error">
      <h2>Dati Supabase non disponibili</h2>
      <p>${escapeHtml(error.message || "Controlla la configurazione del progetto.")}</p>
      <button class="button" id="retry-button">Riprova</button>
    </section>`;
  document.querySelector("#retry-button").addEventListener("click", router);
}

async function getWorkouts() {
  return (await workoutStore.getAll()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function getBodyWeights() {
  return (await bodyWeightStore.getAll()).sort((a, b) => b.date.localeCompare(a.date));
}

function setAuthenticatedLayout(authenticated) {
  document.body.classList.toggle("auth-mode", !authenticated);
  logoutButton.hidden = !authenticated || !isSupabaseConfigured;
  userBadge.hidden = !authenticated;
  userBadge.textContent = authenticated ? displayName() : "";
}

function renderAuth(mode = "login", message = "") {
  const isRegistration = mode === "registration";
  setAuthenticatedLayout(false);
  app.innerHTML = `
    <section class="auth-card card">
      <p class="eyebrow">GymBoard</p>
      <h1>${isRegistration ? "Crea il tuo account." : "Bentornato."}</h1>
      <p class="muted">${isRegistration ? "Inserisci i tuoi dati per iniziare a usare la dashboard." : "Accedi per ritrovare allenamenti e progressi."}</p>
      ${message ? `<p class="auth-message" role="status">${escapeHtml(message)}</p>` : ""}
      <form id="auth-form" class="stack-form">
        ${isRegistration ? '<div class="field"><label for="auth-name">Nome</label><input id="auth-name" name="name" autocomplete="name" maxlength="50" required /></div>' : ""}
        <div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${isRegistration ? "new-password" : "current-password"}" minlength="6" required /></div>
        ${isRegistration ? '<div class="field"><label for="auth-password-confirmation">Conferma password</label><input id="auth-password-confirmation" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="6" required /></div>' : ""}
        ${isRegistration ? "" : `<label class="remember-control" for="auth-remember"><input id="auth-remember" name="remember" type="checkbox" ${isRememberSessionEnabled() ? "checked" : ""} /><span>Ricordami</span></label>`}
        <div class="auth-actions">
          <button class="button" type="submit">${isRegistration ? "Crea account" : "Accedi"}</button>
        </div>
      </form>
      <p class="auth-switch">
        ${isRegistration ? "Hai gia un account?" : "Non hai un account?"}
        <button class="text-button" id="auth-mode-button" type="button">${isRegistration ? "Accedi" : "Registrati"}</button>
      </p>
    </section>`;

  const form = document.querySelector("#auth-form");
  form.addEventListener("submit", (event) => handleAuth(event, mode));
  document.querySelector("#auth-mode-button").addEventListener("click", () => {
    renderAuth(isRegistration ? "login" : "registration");
  });
}

function authValues(mode) {
  const form = document.querySelector("#auth-form");
  if (!form.reportValidity()) return null;
  const data = new FormData(form);
  return {
    name: mode === "registration" ? String(data.get("name")).trim() : "",
    email: String(data.get("email")).trim(),
    password: String(data.get("password")),
    passwordConfirmation: mode === "registration" ? String(data.get("passwordConfirmation")) : "",
    remember: mode === "login" && data.get("remember") === "on",
  };
}

async function handleAuth(event, action) {
  event.preventDefault();
  const values = authValues(action);
  if (!values) return;
  if (action === "registration" && values.password !== values.passwordConfirmation) {
    showToast("Le password non coincidono", true);
    return;
  }
  const buttons = document.querySelectorAll("#auth-form button");
  buttons.forEach((button) => (button.disabled = true));

  try {
    if (!isSupabaseConfigured) {
      if (action === "registration") {
        localStorage.setItem("gymboard-display-name", values.name);
        renderAuth("login", "Account creato. Ora puoi accedere.");
        return;
      }
      currentUser = { user_metadata: { full_name: localStorage.getItem("gymboard-display-name") || "Utente" } };
      await showApp();
      return;
    }

    if (action === "registration") {
      setRememberSession(false);
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { full_name: values.name, display_name: values.name },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw error;
      if (data.session) await supabase.auth.signOut();
      renderAuth("login", "Account creato. Ora puoi accedere.");
      return;
    } else {
      setRememberSession(values.remember);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
      currentUser = data.user;
    }
    await showApp();
  } catch (error) {
    showToast(error.message, true);
    buttons.forEach((button) => (button.disabled = false));
  }
}

async function showApp() {
  setAuthenticatedLayout(true);
  await router();
}

function workoutCard(workout, removable = false) {
  const date = new Date(workout.date);
  return `
    <article class="card workout-card">
      <div class="date-tile"><span>${formatDate(date, { month: "short" })}</span><strong>${date.getDate()}</strong></div>
      <div><h3>${escapeHtml(workout.name)}</h3><p class="workout-meta">${workout.exercises?.length || 0} esercizi · ${formatNumber(workout.volume)} kg</p></div>
      ${removable ? `<button class="button danger" data-remove-workout="${workout.id}" aria-label="Elimina allenamento">×</button>` : ""}
    </article>`;
}

function workoutStats(workouts, period, selectedMonth, selectedYear) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const dayFromMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - dayFromMonday);

  const current = workouts.filter((workout) => {
    const date = new Date(workout.date);
    if (period === "week") return date >= startOfWeek && date <= now;
    if (period === "month") {
      return date.getFullYear() === Number(selectedYear) && date.getMonth() === Number(selectedMonth);
    }
    return date.getFullYear() === Number(selectedYear);
  });

  return {
    count: current.length,
    volume: current.reduce((sum, workout) => sum + workout.volume, 0),
  };
}

function renderHomeStats(workouts) {
  const period = document.querySelector("#stats-period").dataset.value;
  const monthInput = document.querySelector("#stats-month");
  const yearInput = document.querySelector("#stats-year");
  const stats = workoutStats(workouts, period, monthInput.dataset.value, yearInput.dataset.value);
  const volume = period === "week"
    ? `${formatNumber(stats.volume)} kg`
    : `${formatNumber(stats.volume / 1000)} t`;

  document.querySelector("#stats-month-controls").hidden = period !== "month";
  document.querySelector("#stats-year-control").hidden = period === "week";
  document.querySelector("#home-stats").innerHTML = `
    <article class="stat-card"><strong>${stats.count}</strong><span>Sessioni</span></article>
    <article class="stat-card volume-stat"><strong>${volume}</strong><span>Volume totale</span></article>`;
}

function bindStatSelect(id, onChange) {
  const select = document.querySelector(`#${id}`);
  const trigger = select.querySelector(".toggle-select-trigger");
  const menu = select.querySelector(".toggle-select-menu");

  trigger.addEventListener("click", () => {
    const opening = menu.hidden;
    document.querySelectorAll(".toggle-select-menu").forEach((item) => (item.hidden = true));
    document.querySelectorAll(".toggle-select-trigger").forEach((item) => item.setAttribute("aria-expanded", "false"));
    menu.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
  });

  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;
    select.dataset.value = option.dataset.value;
    trigger.querySelector("span").textContent = option.textContent;
    menu.querySelectorAll("button").forEach((button) => button.classList.toggle("selected", button === option));
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    onChange();
  });
}

function openChoiceModal({ title, items, getLabel, getDescription, onSelect }) {
  const modal = document.createElement("div");
  modal.className = "choice-modal";
  modal.innerHTML = `
    <div class="choice-modal-backdrop" data-choice-close></div>
    <section class="choice-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="choice-sheet-header">
        <div><p class="eyebrow">Selezione</p><h2>${escapeHtml(title)}</h2></div>
        <button class="icon-button" type="button" data-choice-close aria-label="Chiudi">×</button>
      </div>
      <div class="field choice-search"><label for="choice-search-input">Cerca</label><input id="choice-search-input" type="text" autocomplete="off" placeholder="Scrivi per filtrare..." /></div>
      <div class="choice-list"></div>
    </section>`;
  document.body.append(modal);
  requestAnimationFrame(() => modal.classList.add("visible"));

  const input = modal.querySelector("#choice-search-input");
  const list = modal.querySelector(".choice-list");
  const close = () => {
    modal.classList.remove("visible");
    window.setTimeout(() => modal.remove(), 180);
  };
  const renderItems = () => {
    const query = input.value.trim().toLowerCase();
    const filtered = items.filter((item) => getLabel(item).toLowerCase().includes(query) || getDescription(item).toLowerCase().includes(query));
    list.innerHTML = filtered.length
      ? filtered.map((item, index) => `<button class="choice-item" type="button" data-choice-index="${index}"><strong>${escapeHtml(getLabel(item))}</strong><span>${escapeHtml(getDescription(item))}</span></button>`).join("")
      : '<div class="empty-state">Nessun risultato.</div>';
    list.querySelectorAll("[data-choice-index]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(filtered[Number(button.dataset.choiceIndex)]);
      close();
    }));
  };

  modal.querySelectorAll("[data-choice-close]").forEach((button) => button.addEventListener("click", close));
  input.addEventListener("input", renderItems);
  renderItems();
  input.focus();
}

async function renderHome() {
  const [workouts, bodyWeights] = await Promise.all([getWorkouts(), getBodyWeights()]);
  const latestWeight = bodyWeights[0];
  const recordedToday = latestWeight?.date === localDateKey();
  const today = new Date();
  const currentMonth = today.getMonth();
  const monthNames = Array.from({ length: 12 }, (_, month) => {
    const name = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(new Date(2024, month, 1));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  const availableYears = [...new Set([
    today.getFullYear(),
    ...workouts.map((workout) => new Date(workout.date).getFullYear()),
  ])].sort((a, b) => b - a);
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Il tuo diario</p><h1>Ciao, ${escapeHtml(displayName())}.</h1><p class="last-weight">${latestWeight ? `Ultimo peso: <strong>${formatNumber(latestWeight.weight)} kg</strong>, registrato il ${formatDate(`${latestWeight.date}T12:00:00`, { day: "numeric", month: "long", year: "numeric" })}.` : "Non hai ancora registrato il peso corporeo."}</p></div></section>
    ${recordedToday ? "" : `<section class="weight-reminder" role="alert"><div><p class="eyebrow">Promemoria di oggi</p><h2>Registra il tuo peso</h2><p>${latestWeight ? "L'ultima misurazione non è di oggi." : "Inizia a costruire il tuo andamento corporeo."}</p></div></section>`}
    <section class="card body-weight-card">
      <div class="weight-heading">
        <div><p class="eyebrow">Peso corporeo</p><h2>${recordedToday ? "Peso di oggi registrato" : "Registra il peso di oggi"}</h2></div>
        ${latestWeight ? `<strong>${formatNumber(latestWeight.weight)} kg</strong>` : ""}
      </div>
      <p class="last-weight">${latestWeight ? `Ultima registrazione: ${formatDate(`${latestWeight.date}T12:00:00`, { day: "numeric", month: "long", year: "numeric" })}.` : "Non hai ancora registrato il peso corporeo."}</p>
      <form id="home-weight-form" class="weight-form">
        <div class="field"><label for="home-body-weight">Peso (kg)</label><input id="home-body-weight" name="weight" type="number" min="20" max="400" step="0.1" required /></div>
        <button class="button" type="submit">${recordedToday ? "Aggiorna peso di oggi" : "Salva peso di oggi"}</button>
      </form>
    </section>
    <section class="hero"><p class="eyebrow">La tua routine</p><h2>Costruisci, registra, migliora.</h2><p>Crea le schede A/B, inserisci i carichi per ogni esercizio e segui i progressi nel tempo.</p><a class="button" href="#workouts">Gestisci schede</a></section>
    <section class="stats-summary" aria-label="Riepilogo allenamenti">
      <div class="stats-controls">
        <div class="toggle-select" id="stats-period" data-value="week">
          <span class="toggle-select-label">Periodo</span>
          <button class="toggle-select-trigger" type="button" aria-expanded="false"><span>Settimana corrente</span><b aria-hidden="true">⌄</b></button>
          <div class="toggle-select-menu" hidden><button class="selected" type="button" data-value="week">Settimana corrente</button><button type="button" data-value="month">Mese</button><button type="button" data-value="year">Anno</button></div>
        </div>
        <div class="toggle-select stats-date-control" id="stats-year-control" hidden>
          <span class="toggle-select-label">Anno</span>
          <div id="stats-year" data-value="${today.getFullYear()}"><button class="toggle-select-trigger" type="button" aria-expanded="false"><span>${today.getFullYear()}</span><b aria-hidden="true">⌄</b></button><div class="toggle-select-menu" hidden>${availableYears.map((year) => `<button class="${year === today.getFullYear() ? "selected" : ""}" type="button" data-value="${year}">${year}</button>`).join("")}</div></div>
        </div>
        <div class="toggle-select stats-date-control" id="stats-month-controls" hidden>
          <span class="toggle-select-label">Mese</span>
          <div id="stats-month" data-value="${currentMonth}"><button class="toggle-select-trigger" type="button" aria-expanded="false"><span>${monthNames[currentMonth]}</span><b aria-hidden="true">⌄</b></button><div class="toggle-select-menu" hidden>${monthNames.map((month, index) => `<button class="${index === currentMonth ? "selected" : ""}" type="button" data-value="${index}">${month}</button>`).join("")}</div></div>
        </div>
      </div>
      <div class="stats-grid" id="home-stats"></div>
    </section>
    <div class="section-heading"><h2>Ultimi allenamenti</h2><a href="#history">Vedi tutti</a></div>
    <div class="workout-list">${workouts.length ? workouts.slice(0, 3).map((workout) => workoutCard(workout)).join("") : '<div class="empty-state">Crea una scheda e registra il primo allenamento.</div>'}</div>`;

  bindStatSelect("stats-period", () => renderHomeStats(workouts));
  bindStatSelect("stats-month", () => renderHomeStats(workouts));
  bindStatSelect("stats-year", () => renderHomeStats(workouts));
  renderHomeStats(workouts);
  document.querySelector("#home-weight-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await bodyWeightStore.upsertByDate({ date: localDateKey(), weight: Number(data.get("weight")) });
      showToast(recordedToday ? "Peso di oggi aggiornato" : "Peso di oggi registrato");
      await renderHome();
    } catch (error) { showToast(error.message, true); }
  });
}

function planCard(plan) {
  const actions = plan.archivedAt
    ? `<div class="card-actions"><button class="button secondary" data-restore-plan="${plan.id}">Ripristina</button><button class="button danger" data-delete-plan="${plan.id}">Elimina definitivamente</button></div>`
    : `<div class="card-actions"><button class="button" data-start-plan="${plan.id}">Avvia</button><button class="button secondary" data-edit-plan="${plan.id}">Modifica</button><button class="button secondary" data-archive-plan="${plan.id}">Archivia</button><button class="button danger" data-delete-plan="${plan.id}">Elimina</button></div>`;
  return `<article class="card template-card ${plan.archivedAt ? "archived-card" : ""}"><div><div class="plan-title"><h3>${escapeHtml(plan.name)}</h3>${plan.archivedAt ? '<span class="status-badge">Archiviata</span>' : ""}</div><p class="workout-meta">${plan.exercises.length} esercizi</p><div class="exercise-tags">${plan.exercises.map((exercise) => `<span class="tag">${escapeHtml(exercise.name)}</span>`).join("")}</div></div>${actions}</article>`;
}

async function renderWorkouts() {
  const [plans, exerciseCatalog] = await Promise.all([planStore.getAll(), exerciseStore.getAll()]);
  const activePlans = plans.filter((plan) => !plan.archivedAt);
  const archivedPlans = plans.filter((plan) => plan.archivedAt);
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Allenamenti</p><h1>Le tue schede.</h1></div></section>
    ${getActiveWorkout() ? '<section class="card active-workout-notice"><div><p class="eyebrow">Allenamento in corso</p><h2>Hai un allenamento in corso. Vuoi riprenderlo?</h2></div><div class="card-actions"><button class="button" id="resume-workout" type="button">Riprendi</button><button class="button danger" id="discard-workout" type="button">Scarta</button></div></section>' : ""}
    <section class="card plan-creator"><h2 id="plan-form-title">Crea una scheda</h2><form id="plan-form" class="stack-form"><input type="hidden" id="plan-id" name="planId" /><div class="field"><label for="plan-name">Nome</label><input id="plan-name" name="name" maxlength="50" placeholder="Lista A" required /></div><div><label class="field-label">Esercizi</label><div class="exercise-builder" id="exercise-builder"></div><button class="text-button" id="add-exercise-row" type="button">+ Aggiungi esercizio</button></div><div class="form-actions"><button class="button" type="submit">Salva scheda</button><button class="button secondary" id="cancel-plan-edit" type="button" hidden>Annulla</button></div></form></section>
    <div class="section-heading"><h2>Schede attive</h2></div><section class="template-grid">${activePlans.length ? activePlans.map(planCard).join("") : '<div class="empty-state">Nessuna scheda attiva. Crea la tua Lista A qui sopra.</div>'}</section>
    ${archivedPlans.length ? `<div class="section-heading"><h2>Schede archiviate</h2></div><section class="template-grid archived-grid">${archivedPlans.map(planCard).join("")}</section>` : ""}<section class="card session-card" id="session-card" hidden></section>`;

  const builder = document.querySelector("#exercise-builder");
  document.querySelector("#resume-workout")?.addEventListener("click", async () => resumeActiveWorkout(plans, await getWorkouts()));
  document.querySelector("#discard-workout")?.addEventListener("click", async () => {
    if (!window.confirm("Scartare l'allenamento in corso? I dati inseriti andranno persi.")) return;
    clearActiveWorkout();
    showToast("Allenamento in corso scartato");
    await renderWorkouts();
  });
  const addRow = (exercise = null) => {
    const row = document.createElement("div");
    row.className = "exercise-builder-row";
    row.dataset.exerciseId = exercise?.id || "";
    row.dataset.exerciseChoice = exercise?.id ? "existing" : "";
    const plannedSets = exercise?.plannedSets ?? "";
    const plannedReps = exercise?.plannedReps ?? "";
    row.innerHTML = `<div class="exercise-order-controls" aria-label="Riordina esercizio"><button class="icon-button move-exercise-up" type="button" aria-label="Sposta esercizio su">↑</button><button class="icon-button move-exercise-down" type="button" aria-label="Sposta esercizio giù">↓</button></div><div class="field exercise-name-field"><label>Nome esercizio</label><input class="exercise-name-input" type="text" maxlength="100" autocomplete="off" value="${escapeHtml(exercise?.name || "")}" placeholder="Es. Panca piana" required /><div class="exercise-suggestions" hidden></div></div><div class="field exercise-category-field"><label>Categoria</label><select class="exercise-category-select">${EXERCISE_CATEGORIES.map((category) => `<option value="${category}" ${(exercise?.category || "Altro") === category ? "selected" : ""}>${category}</option>`).join("")}</select></div><div class="field"><label>Serie</label><input class="planned-sets-input" type="number" min="1" value="${plannedSets}" placeholder="Es. 3" required /></div><div class="field"><label>Ripetizioni</label><input class="planned-reps-input" type="number" min="1" value="${plannedReps}" placeholder="Es. 8" required /></div><button class="button danger remove-exercise-row" type="button" aria-label="Rimuovi esercizio">×</button>`;
    builder.append(row);
    bindExerciseSuggestions(row, exerciseCatalog);
    bindExerciseOrder(row);
  };
  addRow();
  document.querySelector("#add-exercise-row").addEventListener("click", () => addRow());
  document.querySelector("#cancel-plan-edit").addEventListener("click", () => resetPlanForm(addRow));

  document.querySelector("#plan-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rows = [...builder.querySelectorAll(".exercise-builder-row")];
    const selectedExercises = [];
    try {
      for (const row of rows) {
        const name = row.querySelector(".exercise-name-input").value.trim();
        const category = row.querySelector(".exercise-category-select").value;
        const plannedSets = Number(row.querySelector(".planned-sets-input").value);
        const plannedReps = Number(row.querySelector(".planned-reps-input").value);
        if (!name) continue;
        let exercise = exerciseCatalog.find((item) => item.id === row.dataset.exerciseId);
        const hasSimilarMatches = !exercise && row.dataset.exerciseChoice !== "new" && findExerciseMatches(exerciseCatalog, name).length > 0;
        if (hasSimilarMatches) return showToast(`Scegli un suggerimento o crea un nuovo esercizio per "${name}"`, true);
        if (exercise) exercise = await exerciseStore.updateCategory(exercise.id, category);
        else [exercise] = await exerciseStore.resolveNames([{ name, category }]);
        if (!selectedExercises.some((item) => item.exerciseId === exercise.id)) selectedExercises.push({ exerciseId: exercise.id, plannedSets, plannedReps });
      }
      if (!selectedExercises.length) return showToast("Aggiungi almeno un esercizio", true);
      const changes = { name: String(data.get("name")).trim(), exerciseItems: selectedExercises };
      if (data.get("planId")) await planStore.update(String(data.get("planId")), changes);
      else await planStore.add(changes);
      showToast(data.get("planId") ? "Scheda aggiornata" : "Scheda creata");
      await renderWorkouts();
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelectorAll("[data-start-plan]").forEach((button) => button.addEventListener("click", async () => openSession(button.dataset.startPlan, plans, await getWorkouts())));
  document.querySelectorAll("[data-edit-plan]").forEach((button) => button.addEventListener("click", () => {
    const plan = plans.find((item) => item.id === button.dataset.editPlan);
    document.querySelector("#plan-id").value = plan.id;
    document.querySelector("#plan-name").value = plan.name;
    document.querySelector("#plan-form-title").textContent = "Modifica scheda";
    document.querySelector("#cancel-plan-edit").hidden = false;
    builder.innerHTML = "";
    plan.exercises.forEach(addRow);
    document.querySelector(".plan-creator").scrollIntoView({ behavior: "smooth" });
  }));
  document.querySelectorAll("[data-archive-plan]").forEach((button) => button.addEventListener("click", async () => {
    try { await planStore.archive(button.dataset.archivePlan); showToast("Scheda archiviata"); await renderWorkouts(); } catch (error) { showToast(error.message, true); }
  }));
  document.querySelectorAll("[data-restore-plan]").forEach((button) => button.addEventListener("click", async () => {
    try { await planStore.restore(button.dataset.restorePlan); showToast("Scheda ripristinata"); await renderWorkouts(); } catch (error) { showToast(error.message, true); }
  }));
  document.querySelectorAll("[data-delete-plan]").forEach((button) => button.addEventListener("click", async () => {
    const plan = plans.find((item) => item.id === button.dataset.deletePlan);
    const message = plan?.archivedAt
      ? `Eliminare definitivamente la scheda "${plan.name}"? Lo storico degli allenamenti resterà disponibile.`
      : `Eliminare la scheda "${plan?.name || "selezionata"}"? Esercizi e storico degli allenamenti non verranno eliminati.`;
    if (!window.confirm(message)) return;
    try { await planStore.remove(button.dataset.deletePlan); showToast("Scheda eliminata"); await renderWorkouts(); } catch (error) { showToast(error.message, true); }
  }));
}

function bindExerciseOrder(row) {
  row.querySelector(".move-exercise-up").addEventListener("click", () => {
    const previous = row.previousElementSibling;
    if (previous) row.parentElement.insertBefore(row, previous);
  });
  row.querySelector(".move-exercise-down").addEventListener("click", () => {
    const next = row.nextElementSibling;
    if (next) row.parentElement.insertBefore(next, row);
  });
}

function bindExerciseSuggestions(row, catalog) {
  const input = row.querySelector(".exercise-name-input");
  const suggestions = row.querySelector(".exercise-suggestions");
  input.addEventListener("input", () => {
    const selected = catalog.find((exercise) => exercise.id === row.dataset.exerciseId);
    if (!selected || normalizeExerciseName(selected.name) !== normalizeExerciseName(input.value)) {
      row.dataset.exerciseId = "";
      row.dataset.exerciseChoice = "";
    }
    const matches = findExerciseMatches(catalog, input.value);
    suggestions.innerHTML = `${matches.map((exercise) => `<button type="button" data-suggestion-id="${exercise.id}"><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml(exercise.category || "Altro")} · Usa lo storico esistente</span></button>`).join("")}${matches.length ? `<button type="button" data-create-exercise="true"><strong>Crea nuovo esercizio</strong><span>Non collegare ai suggerimenti</span></button>` : ""}`;
    suggestions.hidden = !matches.length;
  });
  suggestions.addEventListener("click", (event) => {
    const createButton = event.target.closest("[data-create-exercise]");
    if (createButton) {
      row.dataset.exerciseId = "";
      row.dataset.exerciseChoice = "new";
      suggestions.hidden = true;
      return;
    }
    const button = event.target.closest("[data-suggestion-id]");
    if (!button) return;
    const exercise = catalog.find((item) => item.id === button.dataset.suggestionId);
    row.dataset.exerciseId = exercise.id;
    row.dataset.exerciseChoice = "existing";
    input.value = exercise.name;
    row.querySelector(".exercise-category-select").value = exercise.category || "Altro";
    suggestions.hidden = true;
  });
  row.querySelector(".remove-exercise-row").addEventListener("click", () => row.remove());
}

function resetPlanForm(addRow) {
  document.querySelector("#plan-form").reset();
  document.querySelector("#plan-id").value = "";
  document.querySelector("#plan-form-title").textContent = "Crea una scheda";
  document.querySelector("#cancel-plan-edit").hidden = true;
  document.querySelector("#exercise-builder").innerHTML = "";
  addRow();
}

function latestExerciseLoads(workouts) {
  const loads = new Map();
  workouts.forEach((workout) => {
    workout.exercises?.forEach((exercise) => {
      if (!loads.has(exercise.exerciseId) && Number.isFinite(Number(exercise.load))) {
        loads.set(exercise.exerciseId, Number(exercise.load));
      }
    });
  });
  return loads;
}

function openSession(planId, plans, workouts) {
  const plan = plans.find((item) => item.id === planId);
  if (!plan) return;
  const existing = getActiveWorkout();
  if (existing && existing.planId !== planId && !window.confirm("Hai già un allenamento in corso. Vuoi scartarlo e iniziarne uno nuovo?")) return;
  const previousLoads = latestExerciseLoads(workouts);
  const draft = existing?.planId === planId ? existing : {
    planId: plan.id,
    name: plan.name,
    notes: "",
    exercises: plan.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.plannedSets || 3,
      reps: exercise.plannedReps || 8,
      load: "",
      previousLoad: previousLoads.get(exercise.id),
    })),
  };
  saveActiveWorkout(draft);
  renderActiveWorkout(plan, draft);
}

function resumeActiveWorkout(plans, workouts) {
  const draft = getActiveWorkout();
  if (!draft) return;
  const previousLoads = latestExerciseLoads(workouts);
  draft.exercises = draft.exercises.map((exercise) => ({
    ...exercise,
    previousLoad: exercise.previousLoad ?? previousLoads.get(exercise.exerciseId),
  }));
  const plan = plans.find((item) => item.id === draft.planId) || {
    id: draft.planId,
    name: draft.name,
    exercises: draft.exercises.map((exercise) => ({ id: exercise.exerciseId, name: exercise.name })),
  };
  renderActiveWorkout(plan, draft);
}

function renderActiveWorkout(plan, draft) {
  const sessionCard = document.querySelector("#session-card");
  sessionCard.hidden = false;
  sessionCard.innerHTML = `<h2>${escapeHtml(plan.name)}</h2><p class="muted">Inserisci i dati svolti. Il volume è serie × ripetizioni × carico.</p><form id="session-form" class="stack-form"><input type="hidden" name="planId" value="${plan.id}" /><div class="exercise-entry-list">${plan.exercises.map((exercise, index) => exerciseEntry(exercise, index, draft.exercises[index])).join("")}</div><div class="field"><label for="workout-notes">Note</label><textarea id="workout-notes" name="notes" placeholder="Note sull'allenamento...">${escapeHtml(draft.notes || "")}</textarea></div><div class="form-actions"><button class="button" type="submit">Completa allenamento</button><button class="button danger" id="discard-active-workout" type="button">Scarta</button></div></form>`;
  sessionCard.scrollIntoView({ behavior: "smooth", block: "start" });
  const form = document.querySelector("#session-form");
  const persistDraft = () => saveActiveWorkout(readSessionDraft(form, plan));
  form.addEventListener("input", persistDraft);
  form.addEventListener("change", persistDraft);
  form.addEventListener("submit", (event) => saveSession(event, plan));
  document.querySelector("#discard-active-workout").addEventListener("click", async () => {
    if (!window.confirm("Scartare l'allenamento in corso? I dati inseriti andranno persi.")) return;
    clearActiveWorkout();
    showToast("Allenamento in corso scartato");
    await renderWorkouts();
  });
}

function exerciseEntry(exercise, index, values = {}) {
  const loadValue = values.load === undefined || values.load === null ? "" : values.load;
  const previousLoad = Number.isFinite(Number(values.previousLoad)) ? Number(values.previousLoad) : null;
  return `<fieldset class="exercise-entry"><legend>${escapeHtml(exercise.name)}</legend><input type="hidden" name="exercise-id-${index}" value="${exercise.id}" /><div class="exercise-values"><div class="field"><label for="sets-${index}">Serie</label><input id="sets-${index}" name="sets-${index}" type="number" min="1" value="${values.sets ?? 3}" required /></div><div class="field"><label for="reps-${index}">Rip.</label><input id="reps-${index}" name="reps-${index}" type="number" min="1" value="${values.reps ?? 8}" required /></div><div class="field"><label for="load-${index}">Kg</label><input id="load-${index}" name="load-${index}" type="number" min="0" step="0.5" value="${escapeHtml(loadValue)}" placeholder="kg" required />${previousLoad === null ? "" : `<small class="field-hint">Ultima volta: ${formatNumber(previousLoad)} kg</small>`}</div></div></fieldset>`;
}

function readSessionDraft(form, plan) {
  const data = new FormData(form);
  return {
    planId: plan.id,
    name: plan.name,
    notes: String(data.get("notes") || ""),
    exercises: plan.exercises.map((exercise, index) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      sets: Number(data.get(`sets-${index}`)),
      reps: Number(data.get(`reps-${index}`)),
      load: String(data.get(`load-${index}`) || ""),
      previousLoad: getActiveWorkout()?.exercises?.[index]?.previousLoad,
    })),
  };
}

async function saveSession(event, plan) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const exercises = plan.exercises.map((exercise, index) => {
    const sets = Number(data.get(`sets-${index}`));
    const reps = Number(data.get(`reps-${index}`));
    const load = Number(data.get(`load-${index}`));
    return { exerciseId: exercise.id, name: exercise.name, sets, reps, load, volume: sets * reps * load };
  });
  try {
    await workoutStore.add({ planId: plan.id, name: plan.name, date: new Date().toISOString(), duration: 1, exercises, volume: exercises.reduce((sum, exercise) => sum + exercise.volume, 0) });
    clearActiveWorkout();
    showToast("Allenamento salvato");
    window.location.hash = "history";
  } catch (error) { showToast(error.message, true); }
}

async function renderHistory() {
  const workouts = await getWorkouts();
  const types = [...new Map(workouts.map((workout) => [workout.planId || workout.name, workout.name])).entries()];
  const months = [...new Set(workouts.map((workout) => workout.date.slice(0, 7)))].sort().reverse();
  const monthOptions = months.map((month) => {
    const label = formatDate(`${month}-01T12:00:00`, { month: "long", year: "numeric" });
    return `<option value="${month}">${escapeHtml(label.charAt(0).toUpperCase() + label.slice(1))}</option>`;
  }).join("");
  app.innerHTML = `<section class="page-header"><div><p class="eyebrow">Storico</p><h1>Ogni sessione conta.</h1></div></section><div class="filters"><div class="field"><label for="history-filter">Scheda</label><select id="history-filter"><option value="all">Tutte</option>${types.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("")}</select></div><div class="field"><label for="history-month">Mese</label><select id="history-month"><option value="">Tutti i mesi</option>${monthOptions}</select></div></div><div class="workout-list" id="history-list"></div>`;
  const updateList = () => {
    const type = document.querySelector("#history-filter").value;
    const month = document.querySelector("#history-month").value;
    const filtered = workouts.filter((workout) => (type === "all" || (workout.planId || workout.name) === type) && (!month || workout.date.startsWith(month)));
    document.querySelector("#history-list").innerHTML = filtered.length ? filtered.map((workout) => workoutCard(workout, true)).join("") : '<div class="empty-state">Nessun allenamento per questi filtri.</div>';
    document.querySelectorAll("[data-remove-workout]").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Eliminare definitivamente questo allenamento? Questa azione non può essere annullata.")) return;
      try { await workoutStore.remove(button.dataset.removeWorkout); showToast("Allenamento eliminato"); await renderHistory(); } catch (error) { showToast(error.message, true); }
    }));
  };
  document.querySelector("#history-filter").addEventListener("change", updateList);
  document.querySelector("#history-month").addEventListener("change", updateList);
  updateList();
}

function exerciseManagementCard(exercise, stats) {
  const createdAt = exercise.createdAt
    ? formatDate(exercise.createdAt, { day: "2-digit", month: "long", year: "numeric" })
    : "Non disponibile";
  return `
    <article class="card exercise-manager-card" data-exercise-card="${exercise.id}">
      <div>
        <div class="plan-title">
          <h3>${escapeHtml(exercise.name)}</h3>
          <span class="status-badge">${escapeHtml(exercise.category || "Altro")}</span>
        </div>
        <p class="workout-meta">Creato: ${escapeHtml(createdAt)}</p>
        <div class="exercise-manager-stats">
          <span>${stats.planCount} schede</span>
          <span>${stats.workoutCount} allenamenti</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="button secondary" data-edit-exercise="${exercise.id}">Modifica</button>
        <button class="button danger" data-delete-exercise="${exercise.id}">Elimina</button>
      </div>
    </article>`;
}

async function renderExercises() {
  const [exercises, plans, workouts] = await Promise.all([exerciseStore.getAll(), planStore.getAll(), getWorkouts()]);
  const stats = new Map(exercises.map((exercise) => [exercise.id, { planCount: 0, workoutCount: 0 }]));

  plans.forEach((plan) => {
    const ids = new Set((plan.exercises || []).map((exercise) => exercise.id));
    ids.forEach((id) => {
      if (stats.has(id)) stats.get(id).planCount += 1;
    });
  });

  workouts.forEach((workout) => {
    const ids = new Set((workout.exercises || []).map((exercise) => exercise.exerciseId));
    ids.forEach((id) => {
      if (stats.has(id)) stats.get(id).workoutCount += 1;
    });
  });

  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Catalogo</p><h1>Esercizi.</h1><p class="muted">Gestisci nome e categoria senza perdere lo storico collegato.</p></div></section>
    <section class="exercise-manager-list">
      ${exercises.length ? exercises.map((exercise) => exerciseManagementCard(exercise, stats.get(exercise.id))).join("") : '<div class="empty-state">Nessun esercizio salvato. Crea una scheda per iniziare.</div>'}
    </section>`;

  document.querySelectorAll("[data-edit-exercise]").forEach((button) => button.addEventListener("click", () => {
    const exercise = exercises.find((item) => item.id === button.dataset.editExercise);
    const card = document.querySelector(`[data-exercise-card="${exercise.id}"]`);
    card.innerHTML = `
      <form class="stack-form exercise-edit-form" data-exercise-form="${exercise.id}">
        <div class="field"><label>Nome</label><input name="name" maxlength="100" value="${escapeHtml(exercise.name)}" required /></div>
        <div class="field"><label>Categoria</label><select name="category">${EXERCISE_CATEGORIES.map((category) => `<option value="${category}" ${(exercise.category || "Altro") === category ? "selected" : ""}>${category}</option>`).join("")}</select></div>
        <div class="form-actions"><button class="button" type="submit">Salva modifiche</button><button class="button secondary" type="button" data-cancel-exercise-edit>Annulla</button></div>
      </form>`;
    card.querySelector("[data-cancel-exercise-edit]").addEventListener("click", renderExercises);
    card.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        await exerciseStore.update(exercise.id, { name: data.get("name"), category: data.get("category") });
        showToast("Esercizio aggiornato");
        await renderExercises();
      } catch (error) { showToast(error.message, true); }
    });
  }));

  document.querySelectorAll("[data-delete-exercise]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Eliminare definitivamente questo esercizio? Verranno rimossi anche tutti i riferimenti collegati. Questa operazione non può essere annullata.")) return;
    try {
      await exerciseStore.remove(button.dataset.deleteExercise);
      showToast("Esercizio eliminato");
      await renderExercises();
    } catch (error) { showToast(error.message, true); }
  }));
}

function lineChart(points, metric, options = {}) {
  if (!points.length) return `<div class="empty-state">${options.emptyMessage || "Nessun dato disponibile."}</div>`;
  const width = 620, height = 280;
  const padding = { top: 34, right: 28, bottom: 34, left: 54 };
  const chartWidth = width - padding.left - padding.right, chartHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value), dataMax = Math.max(...values), dataMin = Math.min(...values);
  const min = options.adaptiveScale ? Math.max(0, Math.floor(dataMin - 2)) : 0;
  const max = options.adaptiveScale ? Math.ceil(dataMax + 2) : Math.max(dataMax, 1), range = Math.max(max - min, 1);
  const x = (index) => padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const y = (value) => padding.top + chartHeight - ((value - min) / range) * chartHeight;
  const coordinates = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const unit = metric === "volume" ? "kg vol." : "kg";
  const gridRatios = [0, 0.25, 0.5, 0.75, 1];
  const gradientId = `chartLineGradient-${metric}-${points.length}-${Math.round(dataMin * 10)}-${Math.round(dataMax * 10)}`;
  const tooltip = (point) => point.tooltip || `${formatDate(point.date, { day: "2-digit", month: "long", year: "numeric" })} · ${formatNumber(point.value)} ${unit}`;
  return `<div class="xy-chart-wrap"><svg class="xy-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento ${unit}">
    <defs>
      <linearGradient id="${gradientId}" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0%" stop-color="#a7a0ff" />
        <stop offset="100%" stop-color="#7c73ff" />
      </linearGradient>
    </defs>
    <rect class="chart-panel" x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" rx="18" />
    ${gridRatios.map((ratio) => { const value = min + range * ratio; return `<g><line class="grid-line" x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}" /><text class="axis-label" x="${padding.left - 12}" y="${y(value) + 4}" text-anchor="end">${formatNumber(value)}</text></g>`; }).join("")}
    <line class="axis" x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${width - padding.right}" y2="${padding.top + chartHeight}" />
    ${points.length > 1 ? `<polyline class="progress-line" points="${coordinates}" />` : ""}
    ${points.length === 1 ? `<circle class="single-progress-marker" cx="${x(0)}" cy="${y(points[0].value)}" r="5"><title>${escapeHtml(tooltip(points[0]))}</title></circle>` : ""}
    ${points.map((point, index) => `<circle class="chart-hit-point" cx="${x(index)}" cy="${y(point.value)}" r="16" tabindex="0"><title>${escapeHtml(tooltip(point))}</title></circle>`).join("")}
  </svg></div>`;
}

const EXERCISE_PERIODS = {
  month: { label: "Ultimo mese", days: 30 },
  year: { label: "Ultimo anno", days: 365 },
  all: { label: "Tutto", days: null },
};

function filterExecutionsByPeriod(executions, period) {
  const config = EXERCISE_PERIODS[period] || EXERCISE_PERIODS.year;
  if (!config.days) return executions;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - config.days);
  return executions.filter((execution) => new Date(execution.date) >= from);
}

async function renderProgress() {
  const [workouts, bodyWeights] = await Promise.all([getWorkouts(), getBodyWeights()]);
  const report = buildWeeklyReport(workouts, bodyWeights);
  const progressParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const selectedId = progressParams.get("exercise");
  const selectedPeriod = EXERCISE_PERIODS[progressParams.get("period")] ? progressParams.get("period") : "year";
  const exercises = trackedExercisesFromHistory(workouts);
  const selected = selectedId ? exercises.find((exercise) => exercise.id === selectedId) : null;
  const categories = Object.entries(report.comparison.volumeByCategory).sort((a, b) => b[1].current - a[1].current);
  const weightTrend = report.rollingWeightTrend52Weeks.filter((point) => point.averageWeight !== null);
  const weekEnd = new Date(report.currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weightDelta = report.comparison.averageWeightDelta;
  const weightPercent = report.comparison.averageWeightDeltaPercent;
  const volumeDelta = report.comparison.volumeDelta;
  const volumePercent = report.comparison.volumeDeltaPercent;
  const currentWeekWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.date);
    return date >= report.currentWeekStart && date <= weekEnd;
  }).length;
  const previousWeekEnd = new Date(report.previousWeekStart);
  previousWeekEnd.setDate(previousWeekEnd.getDate() + 6);
  const previousWeekWorkouts = workouts.filter((workout) => {
    const date = new Date(workout.date);
    return date >= report.previousWeekStart && date <= previousWeekEnd;
  }).length;
  const workoutPercent = previousWeekWorkouts ? ((currentWeekWorkouts - previousWeekWorkouts) / previousWeekWorkouts) * 100 : null;

  app.innerHTML = `<section class="page-header"><div><p class="eyebrow">Progressi</p><h1>Statistiche.</h1><p class="muted">Settimana ${report.weekNumber}: dal ${formatDate(report.currentWeekStart, { day: "2-digit", month: "long" })} al ${formatDate(weekEnd, { day: "2-digit", month: "long", year: "numeric" })}.</p></div></section>
    <section class="report-grid">
      <article class="stat-card report-card"><strong>${report.current.averageWeight === null ? "n/d" : `${formatNumber(report.current.averageWeight)} kg`}</strong><span>${weightPercent === null ? "Media peso settimanale" : `${weightPercent >= 0 ? "+" : ""}${formatNumber(weightPercent)}% peso vs settimana precedente`}</span></article>
      <article class="stat-card report-card"><strong>${currentWeekWorkouts}</strong><span>${workoutPercent === null ? "Allenamenti completati" : `${workoutPercent >= 0 ? "+" : ""}${formatNumber(workoutPercent)}% allenamenti vs settimana precedente`}</span></article>
      <article class="stat-card report-card"><strong>${formatNumber(report.current.totalVolume)} kg</strong><span>${volumePercent >= 0 ? "+" : ""}${formatNumber(volumePercent)}% volume vs settimana precedente</span></article>
      <article class="stat-card report-card"><strong>${volumeDelta >= 0 ? "+" : ""}${formatNumber(volumeDelta)} kg</strong><span>Variazione volume totale</span></article>
    </section>
    <section class="card report-section"><div class="section-heading"><h2>Trend peso rolling 52 settimane</h2></div>${weightTrend.length ? lineChart(weightTrend.map((point) => ({ date: point.weekStart, value: point.averageWeight })), "bodyWeight", { adaptiveScale: true, emptyMessage: "Registra il peso per creare il trend." }) : '<div class="empty-state">Nessun dato peso disponibile per il trend.</div>'}</section>
    <section class="card report-section"><div class="section-heading"><h2>Gruppi muscolari</h2></div>${categories.length ? `<div class="progress-list category-report-list">${categories.map(([category, values]) => { const label = values.deltaPercent === null ? (values.isNew ? "Nuovo" : "--") : `${values.deltaPercent >= 0 ? "+" : ""}${formatNumber(values.deltaPercent)}%`; return `<details class="category-detail"><summary><span>${escapeHtml(category)}</span><strong>${label}</strong></summary><div class="category-detail-body"><p><span>Volume settimana corrente</span><strong>${formatNumber(values.current)} kg</strong></p><p><span>Volume settimana precedente</span><strong>${formatNumber(values.previous)} kg</strong></p><p><span>Variazione</span><strong>${label}</strong></p></div></details>`; }).join("")}</div>` : '<div class="empty-state">Nessun volume registrato nella settimana corrente.</div>'}</section>
    <section class="card report-section" id="exercise-evolution-card"><div class="section-heading"><h2>Evoluzione esercizi</h2></div>${selected ? exerciseProgressDetail(selected, workouts, selectedPeriod) : exerciseProgressSearch()}</section>`;
  if (selected) bindExercisePeriodFilters(selected, workouts);
  else bindExerciseProgressSearch(exercises, workouts);
}

function exerciseProgressSearch() {
  return `
    <p class="muted">Scegli un esercizio presente nello storico per vedere grafico, record e cronologia.</p>
    <div class="field exercise-progress-search">
      <label>Esercizio</label>
      <button class="toggle-select-trigger exercise-picker-trigger" id="exercise-progress-picker" type="button"><span>Seleziona esercizio</span><b aria-hidden="true">⌄</b></button>
    </div>
    <div class="empty-state">Seleziona un esercizio per vedere grafico, record e storico.</div>`;
}

function bindExerciseProgressSearch(exercises, workouts) {
  const trigger = document.querySelector("#exercise-progress-picker");
  if (!trigger) return;
  trigger.addEventListener("click", () => {
    openChoiceModal({
      title: "Scegli esercizio",
      items: exercises,
      getLabel: (exercise) => exercise.name,
      getDescription: (exercise) => exercise.category,
      onSelect: (exercise) => {
        trigger.querySelector("span").textContent = exercise.name;
        updateExerciseProgressCard(exercise, workouts, "year");
        history.replaceState(null, "", `#progress?exercise=${encodeURIComponent(exercise.id)}&period=year`);
      },
    });
  });
}

function updateExerciseProgressCard(exercise, workouts, period) {
  const card = document.querySelector("#exercise-evolution-card");
  if (!card) return;
  card.innerHTML = `
    <div class="section-heading">
      <h2>Evoluzione esercizi</h2>
    </div>
    ${exerciseProgressDetail(exercise, workouts, period)}
  `;
  bindExercisePeriodFilters(exercise, workouts);
}

function bindExercisePeriodFilters(exercise, workouts) {
  document.querySelectorAll(".period-pill").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    const params = new URLSearchParams(link.getAttribute("href").split("?")[1] || "");
    const period = EXERCISE_PERIODS[params.get("period")] ? params.get("period") : "year";
    updateExerciseProgressCard(exercise, workouts, period);
    history.replaceState(null, "", `#progress?exercise=${encodeURIComponent(exercise.id)}&period=${period}`);
  }));
}

function exerciseProgressDetail(selected, workouts, period = "year") {
  const executions = exerciseExecutions(workouts, selected);
  const summary = exerciseProgressSummary(executions);
  const filteredExecutions = filterExecutionsByPeriod(executions, period);
  const points = loadProgressionPoints(filteredExecutions).map((point) => ({
    ...point,
    tooltip: `${formatDate(point.date, { day: "2-digit", month: "long", year: "numeric" })}\n${point.workoutName}\n${point.sets} serie · ${point.reps} rip. · ${formatNumber(point.load)} kg`,
  }));
  const newestFirst = [...executions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const periodLinks = Object.entries(EXERCISE_PERIODS).map(([key, config]) => {
    const active = key === period;
    return `<a class="period-pill ${active ? "active" : ""}" href="#progress?exercise=${encodeURIComponent(selected.id)}&period=${key}" ${active ? 'aria-current="true"' : ""}>${config.label}</a>`;
  }).join("");
  return `
    <a class="text-button" href="#progress">← Cerca un altro esercizio</a>
    <div class="section-heading"><h2>${escapeHtml(selected.name)}</h2></div>
    <p class="muted">${escapeHtml(selected.category)} · Analisi basata sullo storico unico dell'esercizio.</p>
    <section class="stats-grid exercise-summary-grid">
      <article class="stat-card"><strong>${summary.latest ? formatDate(summary.latest.date, { day: "2-digit", month: "short", year: "numeric" }) : "n/d"}</strong><span>Ultimo allenamento</span></article>
      <article class="stat-card"><strong>${formatNumber(summary.personalRecord)} kg</strong><span>Record personale</span></article>
      <article class="stat-card"><strong>${summary.absoluteIncrease >= 0 ? "+" : ""}${formatNumber(summary.absoluteIncrease)} kg</strong><span>Incremento dalla prima registrazione</span></article>
      <article class="stat-card"><strong>${summary.percentIncrease === null ? "--" : `${summary.percentIncrease >= 0 ? "+" : ""}${formatNumber(summary.percentIncrease)}%`}</strong><span>Incremento percentuale</span></article>
    </section>
    <section class="card chart-card"><div class="section-heading chart-heading"><h2>Progressione carico</h2><nav class="period-filter" aria-label="Periodo grafico esercizio">${periodLinks}</nav></div>${lineChart(points, "load", { adaptiveScale: true, emptyMessage: "Nessun dato disponibile per questo periodo." })}</section>
    <details class="card report-section exercise-history-toggle">
      <summary><span class="summary-show">Mostra storico esercizio</span><span class="summary-hide">Nascondi storico esercizio</span><b aria-hidden="true">⌄</b></summary>
      <div class="exercise-history-content">${newestFirst.length ? `<div class="progress-list">${newestFirst.map((execution) => `<article class="progress-row exercise-history-row"><div><strong>${formatDate(execution.date, { day: "2-digit", month: "long", year: "numeric" })}</strong><span>${escapeHtml(execution.workoutName)}</span></div><p>${execution.sets} serie · ${execution.reps} rip. · ${formatNumber(execution.load)} kg</p></article>`).join("")}</div>` : '<div class="empty-state">Nessuna esecuzione registrata.</div>'}</div>
    </details>`;
}

const routes = { home: renderHome, workouts: renderWorkouts, exercises: renderExercises, history: renderHistory, progress: renderProgress, reports: renderProgress, "exercise-progress": renderProgress };

async function router() {
  if (isSupabaseConfigured && !currentUser) return renderAuth();
  showLoading();
  const routeWithParams = window.location.hash.slice(1) || "home";
  const route = routeWithParams.split("?")[0];
  try {
    await (routes[route] || routes.home)();
    document.querySelectorAll("[data-route]").forEach((link) => {
      const active = link.dataset.route === (routes[route] ? route : "home");
      link.classList.toggle("active", active);
      link.toggleAttribute("aria-current", active);
    });
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  } catch (error) { showDataError(error); }
}

async function initialize() {
  if (supabaseInitializationError) {
    setAuthenticatedLayout(false);
    showDataError(new Error("Impossibile caricare il client Supabase. Controlla la connessione e riprova."));
    return;
  }
  if (!isSupabaseConfigured) {
    const savedName = localStorage.getItem("gymboard-display-name");
    if (savedName) { currentUser = { user_metadata: { display_name: savedName } }; await showApp(); }
    else renderAuth();
    return;
  }
  showLoading();
  const { data, error } = await supabase.auth.getSession();
  if (error) return renderAuth("login", error.message);
  currentUser = data.session?.user || null;
  if (currentUser) await showApp(); else renderAuth();
}

logoutButton.addEventListener("click", async () => {
  if (isSupabaseConfigured) await supabase.auth.signOut();
  currentUser = null;
  renderAuth();
});
window.addEventListener("hashchange", router);
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; installButton.hidden = false; });
installButton.addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = undefined; installButton.hidden = true; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => console.warn("Service worker non registrato.")));
initialize();
