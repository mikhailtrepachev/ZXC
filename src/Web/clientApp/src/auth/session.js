const ACCESS_TOKEN_KEY = "zxc_access_token";
const REFRESH_TOKEN_KEY = "zxc_refresh_token";
const USER_PROFILES_KEY = "zxc_user_profiles";
const CARD_PINS_KEY = "zxc_card_pins";

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeRole(value) {
  return String(value || "").trim();
}

function isPayloadExpired(payload) {
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowInSeconds;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function readUserProfiles() {
  try {
    const raw = localStorage.getItem(USER_PROFILES_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeUserProfiles(map) {
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(map));
}

function readCardPins() {
  try {
    const raw = localStorage.getItem(CARD_PINS_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCardPins(map) {
  localStorage.setItem(CARD_PINS_KEY, JSON.stringify(map));
}

export function saveLocalUserProfile({ email, firstName, lastName }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = String(firstName || "").trim();
  const normalizedLastName = String(lastName || "").trim();

  if (!normalizedEmail || !normalizedFirstName || !normalizedLastName) {
    return false;
  }

  const profiles = readUserProfiles();
  profiles[normalizedEmail] = {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    fullName: `${normalizedFirstName} ${normalizedLastName}`.trim(),
  };
  writeUserProfiles(profiles);
  return true;
}

export function getLocalUserProfile(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const profiles = readUserProfiles();
  const value = profiles[normalizedEmail];
  if (!value || typeof value !== "object") {
    return null;
  }

  return value;
}

export function resolveUserDisplayNameByEmail(email, fallback = "") {
  const profile = getLocalUserProfile(email);
  if (profile?.fullName) {
    return profile.fullName;
  }

  return String(fallback || "").trim();
}

export function saveLocalCardPin(cardId, pinCode) {
  const normalizedCardId = Number(cardId);
  const normalizedPinCode = String(pinCode || "").trim();

  if (!Number.isFinite(normalizedCardId) || normalizedCardId <= 0) {
    return false;
  }

  if (!/^\d{4}$/.test(normalizedPinCode)) {
    return false;
  }

  const pins = readCardPins();
  pins[String(normalizedCardId)] = normalizedPinCode;
  writeCardPins(pins);
  return true;
}

export function getLocalCardPin(cardId) {
  const normalizedCardId = Number(cardId);

  if (!Number.isFinite(normalizedCardId) || normalizedCardId <= 0) {
    return "";
  }

  const pins = readCardPins();
  const value = pins[String(normalizedCardId)];
  return typeof value === "string" ? value : "";
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function persistSession(payload) {
  let accessToken = "";
  let refreshToken = "";

  if (typeof payload === "string") {
    const trimmed = payload.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        accessToken = parsed?.accessToken || parsed?.token || "";
        refreshToken = parsed?.refreshToken || "";
      } catch {
        accessToken = trimmed;
      }
    } else if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
      try {
        accessToken = JSON.parse(trimmed);
      } catch {
        accessToken = trimmed.slice(1, -1);
      }
    } else {
      accessToken = trimmed;
    }
  } else if (payload && typeof payload === "object") {
    accessToken = payload.accessToken || payload.token || "";
    refreshToken = payload.refreshToken || "";
  }

  if (!accessToken) {
    return false;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  return true;
}

export function getCurrentUserFromToken() {
  const token = getAccessToken();
  const payload = decodeJwtPayload(token);

  if (!payload) {
    return "";
  }

  return payload.email || payload.unique_name || payload.name || payload.sub || "";
}

export function getCurrentUserRoles() {
  const token = getAccessToken();
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const claimKeys = [
    "role",
    "roles",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  ];

  const result = [];
  for (const key of claimKeys) {
    const raw = payload[key];

    if (Array.isArray(raw)) {
      for (const item of raw) {
        const role = normalizeRole(item);
        if (role) {
          result.push(role);
        }
      }
      continue;
    }

    const role = normalizeRole(raw);
    if (role) {
      result.push(role);
    }
  }

  return Array.from(new Set(result));
}

export function hasRole(expectedRole) {
  const normalizedExpected = normalizeRole(expectedRole).toLowerCase();
  if (!normalizedExpected) {
    return false;
  }

  return getCurrentUserRoles().some((role) => role.toLowerCase() === normalizedExpected);
}

export async function isAuthenticated() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  const payload = decodeJwtPayload(token);
  if (!payload || isPayloadExpired(payload)) {
    return false;
  }

  const endpoints = [
    "/api/UserSessions",
    "/api/Notifications",
    "/api/Users/manage/info",
    "/api/Accounts/info",
  ];

  try {
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return true;
      }
    }

    return true;
  } catch {
    return true;
  }
}

export async function logoutUser() {
  clearSession();
}
