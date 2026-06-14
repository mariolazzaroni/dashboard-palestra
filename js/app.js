import { bodyWeightStore, EXERCISE_CATEGORIES, exerciseStore, findExerciseMatches, normalizeExerciseName, planStore, workoutStore } from "./data-store.js";
import { isRememberSessionEnabled, setRememberSession } from "./auth-storage.js";
import { isSupabaseConfigured, supabase, supabaseInitializationError } from "./supabase-client.js";

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
    ${recordedToday ? "" : `<section class="weight-reminder" role="alert"><div><p class="eyebrow">Promemoria di oggi</p><h2>Registra il tuo peso</h2><p>${latestWeight ? "L'ultima misurazione non è di oggi." : "Inizia a costruire il tuo andamento corporeo."}</p></div><a class="button" href="#progress">Aggiungi peso</a></section>`}
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
}

function planCard(plan) {
  const actions = plan.archivedAt
    ? `<div class="card-actions"><button class="button secondary" data-restore-plan="${plan.id}">Ripristina</button><button class="button danger" data-delete-plan="${plan.id}">Elimina definitivamente</button></div>`
    : `<div class="card-actions"><button class="button" data-start-plan="${plan.id}">Avvia</button><button class="button secondary" data-edit-plan="${plan.id}">Modifica</button><button class="button secondary" data-archive-plan="${plan.id}">Archivia</button><button class="button danger" data-delete-plan="${plan.id}">Elimina</button></div>`;
  return `<article class="card template-card ${plan.archivedAt ? "archived-card" : ""}"><div><div class="plan-title"><h3>${escapeHtml(plan.name)}</h3>${plan.archivedAt ? '<span class="status-badge">Archiviata</span>' : ""}</div><p class="workout-meta">${plan.exercises.length} esercizi</p><div class="exercise-tags">${plan.exercises.map((exercise) => `<span class="tag">${escapeHtml(exercise.name)}</span>`).join("")}</div></div>${actions}</article>`;
}

async function renderWorkouts() {
  const [plans, exerciseCatalog, workouts] = await Promise.all([planStore.getAll(), exerciseStore.getAll(), getWorkouts()]);
  const activePlans = plans.filter((plan) => !plan.archivedAt);
  const archivedPlans = plans.filter((plan) => plan.archivedAt);
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Allenamenti</p><h1>Le tue schede.</h1></div></section>
    ${getActiveWorkout() ? '<section class="card active-workout-notice"><div><p class="eyebrow">Allenamento in corso</p><h2>Hai un allenamento in corso. Vuoi riprenderlo?</h2></div><div class="card-actions"><button class="button" id="resume-workout" type="button">Riprendi</button><button class="button danger" id="discard-workout" type="button">Scarta</button></div></section>' : ""}
    <section class="card plan-creator"><h2 id="plan-form-title">Crea una scheda</h2><form id="plan-form" class="stack-form"><input type="hidden" id="plan-id" name="planId" /><div class="field"><label for="plan-name">Nome</label><input id="plan-name" name="name" maxlength="50" placeholder="Lista A" required /></div><div><label class="field-label">Esercizi</label><div class="exercise-builder" id="exercise-builder"></div><button class="text-button" id="add-exercise-row" type="button">+ Aggiungi esercizio</button></div><div class="form-actions"><button class="button" type="submit">Salva scheda</button><button class="button secondary" id="cancel-plan-edit" type="button" hidden>Annulla</button></div></form></section>
    <div class="section-heading"><h2>Schede attive</h2></div><section class="template-grid">${activePlans.length ? activePlans.map(planCard).join("") : '<div class="empty-state">Nessuna scheda attiva. Crea la tua Lista A qui sopra.</div>'}</section>
    ${archivedPlans.length ? `<div class="section-heading"><h2>Schede archiviate</h2></div><section class="template-grid archived-grid">${archivedPlans.map(planCard).join("")}</section>` : ""}<section class="card session-card" id="session-card" hidden></section>`;

  const builder = document.querySelector("#exercise-builder");
  document.querySelector("#resume-workout")?.addEventListener("click", () => resumeActiveWorkout(plans, workouts));
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
    row.innerHTML = `<div class="field exercise-name-field"><label>Nome esercizio</label><input class="exercise-name-input" type="text" maxlength="100" autocomplete="off" value="${escapeHtml(exercise?.name || "")}" placeholder="Es. Panca piana" required /><div class="exercise-suggestions" hidden></div></div><div class="field exercise-category-field"><label>Categoria</label><select class="exercise-category-select">${EXERCISE_CATEGORIES.map((category) => `<option value="${category}" ${(exercise?.category || "Altro") === category ? "selected" : ""}>${category}</option>`).join("")}</select></div><button class="button danger remove-exercise-row" type="button" aria-label="Rimuovi esercizio">×</button>`;
    builder.append(row);
    bindExerciseSuggestions(row, exerciseCatalog);
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
        if (!name) continue;
        let exercise = exerciseCatalog.find((item) => item.id === row.dataset.exerciseId);
        if (exercise) exercise = await exerciseStore.updateCategory(exercise.id, category);
        else [exercise] = await exerciseStore.resolveNames([{ name, category }]);
        if (!selectedExercises.some((item) => item.id === exercise.id)) selectedExercises.push(exercise);
      }
      if (!selectedExercises.length) return showToast("Aggiungi almeno un esercizio", true);
      const changes = { name: String(data.get("name")).trim(), exerciseIds: selectedExercises.map((exercise) => exercise.id) };
      if (data.get("planId")) await planStore.update(String(data.get("planId")), changes);
      else await planStore.add(changes);
      showToast(data.get("planId") ? "Scheda aggiornata" : "Scheda creata");
      await renderWorkouts();
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelectorAll("[data-start-plan]").forEach((button) => button.addEventListener("click", () => openSession(button.dataset.startPlan, plans, workouts)));
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

function bindExerciseSuggestions(row, catalog) {
  const input = row.querySelector(".exercise-name-input");
  const suggestions = row.querySelector(".exercise-suggestions");
  input.addEventListener("input", () => {
    const selected = catalog.find((exercise) => exercise.id === row.dataset.exerciseId);
    if (!selected || normalizeExerciseName(selected.name) !== normalizeExerciseName(input.value)) row.dataset.exerciseId = "";
    const matches = findExerciseMatches(catalog, input.value);
    suggestions.innerHTML = matches.map((exercise) => `<button type="button" data-suggestion-id="${exercise.id}"><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml(exercise.category || "Altro")} · Usa lo storico esistente</span></button>`).join("");
    suggestions.hidden = !matches.length;
  });
  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion-id]");
    if (!button) return;
    const exercise = catalog.find((item) => item.id === button.dataset.suggestionId);
    row.dataset.exerciseId = exercise.id;
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
      sets: 3,
      reps: 8,
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

function getTrackedExercises(workouts) {
  const exercises = new Map();
  workouts.forEach((workout) => {
    workout.exercises?.forEach((exercise) => {
      const key = exercise.exerciseId || normalizeExerciseName(exercise.name);
      if (!exercises.has(key)) exercises.set(key, { id: key, name: exercise.name });
    });
  });
  return [...exercises.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getExercisePoints(workouts, exerciseId, metric) {
  return [...workouts].reverse().flatMap((workout) => {
    const exercise = workout.exercises?.find((item) => (item.exerciseId || normalizeExerciseName(item.name)) === exerciseId);
    return exercise ? [{ date: workout.date, value: exercise[metric] }] : [];
  });
}

function lineChart(points, metric, options = {}) {
  if (!points.length) return `<div class="empty-state">${options.emptyMessage || "Nessun dato disponibile."}</div>`;
  const width = 620, height = 260;
  const padding = { top: 25, right: 20, bottom: 45, left: 55 };
  const chartWidth = width - padding.left - padding.right, chartHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.value), dataMax = Math.max(...values), dataMin = Math.min(...values);
  const min = options.adaptiveScale ? Math.max(0, Math.floor(dataMin - 2)) : 0;
  const max = options.adaptiveScale ? Math.ceil(dataMax + 2) : Math.max(dataMax, 1), range = Math.max(max - min, 1);
  const x = (index) => padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const y = (value) => padding.top + chartHeight - ((value - min) / range) * chartHeight;
  const coordinates = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const unit = metric === "volume" ? "kg vol." : "kg";
  return `<div class="xy-chart-wrap"><svg class="xy-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento ${unit}"><line class="axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" /><line class="axis" x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${width - padding.right}" y2="${padding.top + chartHeight}" />${[0, 0.5, 1].map((ratio) => { const value = min + range * ratio; return `<g><line class="grid-line" x1="${padding.left}" y1="${y(value)}" x2="${width - padding.right}" y2="${y(value)}" /><text class="axis-label" x="${padding.left - 10}" y="${y(value) + 4}" text-anchor="end">${formatNumber(value)}</text></g>`; }).join("")}<polyline class="progress-line" points="${coordinates}" />${points.map((point, index) => `<g><circle class="progress-point" cx="${x(index)}" cy="${y(point.value)}" r="5" /><text class="point-value" x="${x(index)}" y="${y(point.value) - 11}" text-anchor="middle">${formatNumber(point.value)}</text><text class="axis-label" x="${x(index)}" y="${height - 17}" text-anchor="middle">${formatDate(point.date, { day: "2-digit", month: "2-digit" })}</text></g>`).join("")}</svg></div>`;
}

async function renderProgress() {
  const [workouts, bodyWeights] = await Promise.all([getWorkouts(), getBodyWeights()]);
  const trackedExercises = getTrackedExercises(workouts);
  app.innerHTML = `<section class="page-header"><div><p class="eyebrow">Progressi</p><h1>Un esercizio alla volta.</h1></div></section><section class="card body-weight-card"><div class="weight-heading"><div><p class="eyebrow">Peso corporeo</p><h2>Registra il peso di oggi</h2></div>${bodyWeights[0] ? `<strong>${formatNumber(bodyWeights[0].weight)} kg</strong>` : ""}</div><form id="body-weight-form" class="weight-form"><div class="field"><label for="body-weight">Peso (kg)</label><input id="body-weight" name="weight" type="number" min="20" max="400" step="0.1" required /></div><button class="button" type="submit">Salva peso di oggi</button></form><div>${lineChart([...bodyWeights].reverse().map((entry) => ({ date: `${entry.date}T12:00:00`, value: entry.weight })), "bodyWeight", { adaptiveScale: true, emptyMessage: "Registra il primo peso per creare il grafico." })}</div></section><div class="section-heading"><h2>Progressi esercizi</h2></div><p class="muted">I dati dello stesso esercizio sono aggregati da tutte le schede, comprese quelle archiviate.</p>${trackedExercises.length ? `<div class="filters"><div class="field"><label for="exercise-filter">Esercizio</label><select id="exercise-filter">${trackedExercises.map((exercise) => `<option value="${escapeHtml(exercise.id)}">${escapeHtml(exercise.name)}</option>`).join("")}</select></div><div class="field"><label for="metric-filter">Metrica</label><select id="metric-filter"><option value="load">Carico (kg)</option><option value="volume">Volume</option></select></div></div><section class="card chart-card"><div id="exercise-chart"></div></section><section class="stats-grid" id="exercise-stats"></section>` : '<div class="empty-state">Registra almeno un allenamento per vedere i grafici.</div>'}`;
  document.querySelector("#body-weight-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const today = localDateKey();
    const alreadyRecordedToday = bodyWeights.some((entry) => entry.date === today);
    try { await bodyWeightStore.upsertByDate({ date: today, weight: Number(data.get("weight")) }); showToast(alreadyRecordedToday ? "Peso di oggi aggiornato" : "Peso di oggi registrato"); await renderProgress(); } catch (error) { showToast(error.message, true); }
  });
  if (!trackedExercises.length) return;
  const updateChart = () => {
    const exerciseId = document.querySelector("#exercise-filter").value, metric = document.querySelector("#metric-filter").value;
    const exercise = trackedExercises.find((item) => item.id === exerciseId);
    const points = getExercisePoints(workouts, exerciseId, metric), values = points.map((point) => point.value);
    const latest = values.at(-1) || 0, best = Math.max(...values, 0), change = values.length > 1 ? latest - values[0] : 0;
    document.querySelector("#exercise-chart").innerHTML = `<h2>${escapeHtml(exercise.name)}</h2>${lineChart(points, metric)}`;
    document.querySelector("#exercise-stats").innerHTML = `<article class="stat-card"><strong>${formatNumber(latest)}</strong><span>Ultimo valore</span></article><article class="stat-card"><strong>${formatNumber(best)}</strong><span>Record</span></article><article class="stat-card"><strong>${change >= 0 ? "+" : ""}${formatNumber(change)}</strong><span>Variazione</span></article>`;
  };
  document.querySelector("#exercise-filter").addEventListener("change", updateChart);
  document.querySelector("#metric-filter").addEventListener("change", updateChart);
  updateChart();
}

const routes = { home: renderHome, workouts: renderWorkouts, history: renderHistory, progress: renderProgress };

async function router() {
  if (isSupabaseConfigured && !currentUser) return renderAuth();
  showLoading();
  const route = window.location.hash.slice(1) || "home";
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
