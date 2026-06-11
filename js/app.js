import { planStore, workoutStore } from "./data-store.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const installButton = document.querySelector("#install-button");
let deferredInstallPrompt;

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (date, options) =>
  new Intl.DateTimeFormat("it-IT", options).format(new Date(date));
const formatNumber = (number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(number);
const getWorkouts = () =>
  workoutStore.getAll().sort((a, b) => new Date(b.date) - new Date(a.date));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function workoutCard(workout, removable = false) {
  const date = new Date(workout.date);
  const exerciseCount = workout.exercises?.length || 0;
  return `
    <article class="card workout-card">
      <div class="date-tile">
        <span>${formatDate(date, { month: "short" })}</span>
        <strong>${date.getDate()}</strong>
      </div>
      <div>
        <h3>${escapeHtml(workout.name)}</h3>
        <p class="workout-meta">${workout.duration} min · ${exerciseCount} esercizi · ${formatNumber(workout.volume)} kg</p>
      </div>
      ${removable ? `<button class="button danger" data-remove-workout="${workout.id}" aria-label="Elimina allenamento">×</button>` : ""}
    </article>`;
}

function weeklyStats(workouts) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const current = workouts.filter((workout) => new Date(workout.date) >= start);
  return {
    count: current.length,
    minutes: current.reduce((sum, workout) => sum + workout.duration, 0),
    volume: current.reduce((sum, workout) => sum + workout.volume, 0),
  };
}

function renderHome() {
  const workouts = getWorkouts();
  const stats = weeklyStats(workouts);
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Il tuo diario</p><h1>Ciao, Mario.</h1></div></section>
    <section class="hero">
      <p class="eyebrow">La tua routine</p>
      <h2>Costruisci, registra, migliora.</h2>
      <p>Crea le schede A/B, inserisci i carichi per ogni esercizio e segui i progressi nel tempo.</p>
      <a class="button" href="#workouts">Gestisci schede</a>
    </section>
    <section class="stats-grid" aria-label="Riepilogo settimanale">
      <article class="stat-card"><strong>${stats.count}</strong><span>Sessioni</span></article>
      <article class="stat-card"><strong>${stats.minutes}</strong><span>Minuti</span></article>
      <article class="stat-card"><strong>${formatNumber(stats.volume / 1000)}t</strong><span>Volume</span></article>
    </section>
    <div class="section-heading"><h2>Ultimi allenamenti</h2><a href="#history">Vedi tutti</a></div>
    <div class="workout-list">
      ${workouts.length ? workouts.slice(0, 3).map((workout) => workoutCard(workout)).join("") : '<div class="empty-state">Crea una scheda e registra il primo allenamento.</div>'}
    </div>`;
}

function renderWorkouts() {
  const plans = planStore.getAll();
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Allenamenti</p><h1>Le tue schede.</h1></div></section>
    <section class="card plan-creator">
      <h2>Crea una scheda</h2>
      <form id="plan-form" class="stack-form">
        <div class="field"><label for="plan-name">Nome</label><input id="plan-name" name="name" maxlength="50" placeholder="Lista A" required /></div>
        <div class="field"><label for="plan-exercises">Esercizi, uno per riga</label><textarea id="plan-exercises" name="exercises" rows="5" maxlength="800" placeholder="Panca piana&#10;Rematore&#10;Squat" required></textarea></div>
        <button class="button" type="submit">Salva scheda</button>
      </form>
    </section>
    <div class="section-heading"><h2>Schede salvate</h2></div>
    <section class="template-grid">
      ${plans.length ? plans.map(planCard).join("") : '<div class="empty-state">Nessuna scheda. Crea la tua Lista A qui sopra.</div>'}
    </section>
    <section class="card session-card" id="session-card" hidden></section>`;

  document.querySelector("#plan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const exercises = String(data.get("exercises"))
      .split(/\n|,/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!exercises.length) return showToast("Aggiungi almeno un esercizio");
    planStore.add({ name: String(data.get("name")).trim(), exercises });
    showToast("Scheda creata");
    renderWorkouts();
  });

  document.querySelectorAll("[data-start-plan]").forEach((button) => {
    button.addEventListener("click", () => openSession(button.dataset.startPlan));
  });
  document.querySelectorAll("[data-remove-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      planStore.remove(button.dataset.removePlan);
      showToast("Scheda eliminata");
      renderWorkouts();
    });
  });
}

function planCard(plan) {
  return `
    <article class="card template-card">
      <div>
        <h3>${escapeHtml(plan.name)}</h3>
        <p class="workout-meta">${plan.exercises.length} esercizi</p>
        <div class="exercise-tags">${plan.exercises.map((name) => `<span class="tag">${escapeHtml(name)}</span>`).join("")}</div>
      </div>
      <div class="card-actions">
        <button class="button" data-start-plan="${plan.id}">Avvia</button>
        <button class="button danger" data-remove-plan="${plan.id}" aria-label="Elimina scheda">×</button>
      </div>
    </article>`;
}

function openSession(planId) {
  const plan = planStore.getAll().find((item) => item.id === planId);
  if (!plan) return;
  const sessionCard = document.querySelector("#session-card");
  sessionCard.hidden = false;
  sessionCard.innerHTML = `
    <h2>${escapeHtml(plan.name)}</h2>
    <p class="muted">Inserisci i dati svolti. Il volume viene calcolato come serie × ripetizioni × carico.</p>
    <form id="session-form" class="stack-form">
      <input type="hidden" name="planId" value="${plan.id}" />
      <div class="field"><label for="duration">Durata (min)</label><input id="duration" name="duration" type="number" min="1" value="60" required /></div>
      <div class="exercise-entry-list">
        ${plan.exercises.map((name, index) => exerciseEntry(name, index)).join("")}
      </div>
      <button class="button" type="submit">Salva allenamento</button>
    </form>`;
  sessionCard.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#session-form").addEventListener("submit", saveSession);
}

function exerciseEntry(name, index) {
  return `
    <fieldset class="exercise-entry">
      <legend>${escapeHtml(name)}</legend>
      <input type="hidden" name="exercise-${index}-name" value="${escapeHtml(name)}" />
      <div class="exercise-values">
        <div class="field"><label for="sets-${index}">Serie</label><input id="sets-${index}" name="exercise-${index}-sets" type="number" min="1" value="3" required /></div>
        <div class="field"><label for="reps-${index}">Rip.</label><input id="reps-${index}" name="exercise-${index}-reps" type="number" min="1" value="8" required /></div>
        <div class="field"><label for="load-${index}">Kg</label><input id="load-${index}" name="exercise-${index}-load" type="number" min="0" step="0.5" value="0" required /></div>
      </div>
    </fieldset>`;
}

function saveSession(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const plan = planStore.getAll().find((item) => item.id === data.get("planId"));
  if (!plan) return;
  const exercises = plan.exercises.map((name, index) => {
    const sets = Number(data.get(`exercise-${index}-sets`));
    const reps = Number(data.get(`exercise-${index}-reps`));
    const load = Number(data.get(`exercise-${index}-load`));
    return { name, sets, reps, load, volume: sets * reps * load };
  });
  workoutStore.add({
    planId: plan.id,
    name: plan.name,
    date: new Date().toISOString(),
    duration: Number(data.get("duration")),
    exercises,
    volume: exercises.reduce((sum, exercise) => sum + exercise.volume, 0),
  });
  showToast("Allenamento salvato");
  window.location.hash = "history";
}

function renderHistory() {
  const workouts = getWorkouts();
  const types = [...new Map(workouts.map((workout) => [workout.planId || workout.name, workout.name])).entries()];
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Storico</p><h1>Ogni sessione conta.</h1></div></section>
    <div class="filters">
      <div class="field"><label for="history-filter">Scheda</label><select id="history-filter"><option value="all">Tutte</option>${types.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("")}</select></div>
      <div class="field"><label for="history-month">Mese</label><input id="history-month" type="month" /></div>
    </div>
    <div class="workout-list" id="history-list"></div>`;

  const updateList = () => {
    const type = document.querySelector("#history-filter").value;
    const month = document.querySelector("#history-month").value;
    const filtered = workouts.filter((workout) =>
      (type === "all" || (workout.planId || workout.name) === type) && (!month || workout.date.startsWith(month)),
    );
    document.querySelector("#history-list").innerHTML = filtered.length
      ? filtered.map((workout) => workoutCard(workout, true)).join("")
      : '<div class="empty-state">Nessun allenamento per questi filtri.</div>';
    document.querySelectorAll("[data-remove-workout]").forEach((button) => {
      button.addEventListener("click", () => {
        workoutStore.remove(button.dataset.removeWorkout);
        showToast("Allenamento eliminato");
        renderHistory();
      });
    });
  };
  document.querySelector("#history-filter").addEventListener("change", updateList);
  document.querySelector("#history-month").addEventListener("change", updateList);
  updateList();
}

function getExerciseNames(workouts) {
  return [...new Set(workouts.flatMap((workout) => workout.exercises?.map((exercise) => exercise.name) || []))].sort();
}

function getExercisePoints(workouts, exerciseName, metric) {
  return [...workouts]
    .reverse()
    .flatMap((workout) => {
      const exercise = workout.exercises?.find((item) => item.name === exerciseName);
      return exercise ? [{ date: workout.date, value: exercise[metric] }] : [];
    });
}

function lineChart(points, metric) {
  if (!points.length) return '<div class="empty-state">Nessun dato per questo esercizio.</div>';
  const width = 620;
  const height = 260;
  const padding = { top: 25, right: 20, bottom: 45, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...points.map((point) => point.value), 1);
  const x = (index) => padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const y = (value) => padding.top + chartHeight - (value / max) * chartHeight;
  const coordinates = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const unit = metric === "load" ? "kg" : "kg vol.";
  return `
    <div class="xy-chart-wrap">
      <svg class="xy-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento ${unit}">
        <line class="axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" />
        <line class="axis" x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${width - padding.right}" y2="${padding.top + chartHeight}" />
        ${[0, 0.5, 1].map((ratio) => `<g><line class="grid-line" x1="${padding.left}" y1="${y(max * ratio)}" x2="${width - padding.right}" y2="${y(max * ratio)}" /><text class="axis-label" x="${padding.left - 10}" y="${y(max * ratio) + 4}" text-anchor="end">${formatNumber(max * ratio)}</text></g>`).join("")}
        <polyline class="progress-line" points="${coordinates}" />
        ${points.map((point, index) => `<g><circle class="progress-point" cx="${x(index)}" cy="${y(point.value)}" r="5" /><text class="point-value" x="${x(index)}" y="${y(point.value) - 11}" text-anchor="middle">${formatNumber(point.value)}</text><text class="axis-label" x="${x(index)}" y="${height - 17}" text-anchor="middle">${formatDate(point.date, { day: "2-digit", month: "2-digit" })}</text></g>`).join("")}
      </svg>
    </div>`;
}

function renderProgress() {
  const workouts = getWorkouts();
  const exerciseNames = getExerciseNames(workouts);
  app.innerHTML = `
    <section class="page-header"><div><p class="eyebrow">Progressi</p><h1>Un esercizio alla volta.</h1></div></section>
    <p class="muted">Scegli un esercizio e confronta carico o volume nel tempo.</p>
    ${exerciseNames.length ? `
      <div class="filters">
        <div class="field"><label for="exercise-filter">Esercizio</label><select id="exercise-filter">${exerciseNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}</select></div>
        <div class="field"><label for="metric-filter">Metrica</label><select id="metric-filter"><option value="load">Carico (kg)</option><option value="volume">Volume</option></select></div>
      </div>
      <section class="card chart-card"><div id="exercise-chart"></div></section>
      <section class="stats-grid" id="exercise-stats"></section>` : '<div class="empty-state">Registra almeno un allenamento per vedere i grafici dei tuoi esercizi.</div>'}`;

  if (!exerciseNames.length) return;
  const updateChart = () => {
    const exerciseName = document.querySelector("#exercise-filter").value;
    const metric = document.querySelector("#metric-filter").value;
    const points = getExercisePoints(workouts, exerciseName, metric);
    const values = points.map((point) => point.value);
    const latest = values.at(-1) || 0;
    const best = Math.max(...values, 0);
    const change = values.length > 1 ? latest - values[0] : 0;
    document.querySelector("#exercise-chart").innerHTML = `<h2>${escapeHtml(exerciseName)}</h2>${lineChart(points, metric)}`;
    document.querySelector("#exercise-stats").innerHTML = `
      <article class="stat-card"><strong>${formatNumber(latest)}</strong><span>Ultimo valore</span></article>
      <article class="stat-card"><strong>${formatNumber(best)}</strong><span>Record</span></article>
      <article class="stat-card"><strong>${change >= 0 ? "+" : ""}${formatNumber(change)}</strong><span>Variazione</span></article>`;
  };
  document.querySelector("#exercise-filter").addEventListener("change", updateChart);
  document.querySelector("#metric-filter").addEventListener("change", updateChart);
  updateChart();
}

const routes = { home: renderHome, workouts: renderWorkouts, history: renderHistory, progress: renderProgress };

function router() {
  const route = window.location.hash.slice(1) || "home";
  (routes[route] || routes.home)();
  document.querySelectorAll("[data-route]").forEach((link) => {
    const active = link.dataset.route === (routes[route] ? route : "home");
    link.classList.toggle("active", active);
    link.toggleAttribute("aria-current", active);
  });
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = undefined;
  installButton.hidden = true;
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => console.warn("Service worker non registrato.")));
}
