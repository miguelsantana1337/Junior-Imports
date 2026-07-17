const legacySupabaseAuthKey =
  /^(?:sb-[a-z0-9-]+-auth-token(?:[.-].*)?|supabase\.auth\..*)$/i;

const adminSensitiveKey = /(?::store-data:v1$|^junior-imports:product-draft:)/;

export function readSensitiveSessionValue(key: string) {
  let sessionValue: string | null = null;
  let legacyValue: string | null = null;

  try {
    sessionValue = window.sessionStorage.getItem(key);
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }

  try {
    legacyValue = window.localStorage.getItem(key);
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }

  if (sessionValue === null && legacyValue !== null) {
    try {
      window.sessionStorage.setItem(key, legacyValue);
      sessionValue = legacyValue;
    } catch {
      // The value remains available in memory for the current render.
    }
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort cleanup when localStorage is blocked.
  }

  return sessionValue ?? legacyValue;
}

export function writeSensitiveSessionValue(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // The feature continues in memory if sessionStorage is unavailable.
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort cleanup when localStorage is blocked.
  }
}

export function removeSensitiveBrowserValue(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Best-effort cleanup.
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort cleanup.
  }
}

function removeMatchingKeys(storage: Storage, matches: (key: string) => boolean) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && matches(key)) storage.removeItem(key);
  }
}

export function purgeLegacyAuthLocalStorage() {
  try {
    removeMatchingKeys(window.localStorage, (key) => legacySupabaseAuthKey.test(key));
  } catch {
    // Best-effort cleanup for browsers that deny storage access.
  }
}

export function clearAdminSensitiveBrowserStorage() {
  try {
    removeMatchingKeys(window.sessionStorage, (key) => adminSensitiveKey.test(key));
  } catch {
    // Best-effort cleanup.
  }
  try {
    removeMatchingKeys(
      window.localStorage,
      (key) => adminSensitiveKey.test(key) || legacySupabaseAuthKey.test(key),
    );
  } catch {
    // Best-effort cleanup.
  }
}
