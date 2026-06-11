const WORKOUTS_KEY = "liftlog-workouts-v2";
const PLANS_KEY = "liftlog-plans-v1";
const BODY_WEIGHTS_KEY = "gymboard-body-weights-v1";

class LocalStore {
  constructor(key) {
    this.key = key;
  }

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch {
      return [];
    }
  }

  save(items) {
    localStorage.setItem(this.key, JSON.stringify(items));
  }

  add(item) {
    const newItem = {
      id: crypto.randomUUID?.() ?? `${this.key}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...item,
    };
    this.save([newItem, ...this.getAll()]);
    return newItem;
  }

  remove(id) {
    this.save(this.getAll().filter((item) => item.id !== id));
  }

  upsertByDate(item) {
    const existing = this.getAll().find((entry) => entry.date === item.date);
    if (existing) {
      const updated = { ...existing, ...item };
      this.save(this.getAll().map((entry) => (entry.id === existing.id ? updated : entry)));
      return updated;
    }
    return this.add(item);
  }
}

// Questi adapter potranno essere sostituiti da repository Supabase.
export const workoutStore = new LocalStore(WORKOUTS_KEY);
export const planStore = new LocalStore(PLANS_KEY);
export const bodyWeightStore = new LocalStore(BODY_WEIGHTS_KEY);
