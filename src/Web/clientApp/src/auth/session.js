const ACCESS_TOKEN_KEY = "zxc_access_token";
const REFRESH_TOKEN_KEY = "zxc_refresh_token";
const USER_PROFILES_KEY = "zxc_user_profiles";

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

export async function isAuthenticated() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch("/api/Accounts/info", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function logoutUser() {
  clearSession();
}
