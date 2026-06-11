const REMEMBER_KEY = "gymboard-remember-session";
const AUTH_TOKEN_MARKER = "auth-token";

function authKeys(storage) {
  return Object.keys(storage).filter((key) => key.includes(AUTH_TOKEN_MARKER));
}

function rememberPreference() {
  return localStorage.getItem(REMEMBER_KEY);
}

export function isRememberSessionEnabled() {
  return rememberPreference() === "true";
}

export function setRememberSession(enabled) {
  localStorage.setItem(REMEMBER_KEY, String(enabled));

  if (enabled) {
    authKeys(sessionStorage).forEach((key) => {
      localStorage.setItem(key, sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
    });
    return;
  }

  // Una nuova sessione non ricordata non deve recuperare vecchi token persistenti.
  authKeys(localStorage).forEach((key) => localStorage.removeItem(key));
}

export const supabaseAuthStorage = {
  getItem(key) {
    const preference = rememberPreference();

    if (preference === "true") return localStorage.getItem(key);
    if (preference === "false") return sessionStorage.getItem(key);

    // Mantiene compatibili le sessioni create prima dell'aggiunta di Ricordami.
    const legacySession = localStorage.getItem(key);
    if (legacySession) {
      localStorage.setItem(REMEMBER_KEY, "true");
      return legacySession;
    }
    return sessionStorage.getItem(key);
  },

  setItem(key, value) {
    const storage = isRememberSessionEnabled() ? localStorage : sessionStorage;
    const otherStorage = storage === localStorage ? sessionStorage : localStorage;
    storage.setItem(key, value);
    otherStorage.removeItem(key);
  },

  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
