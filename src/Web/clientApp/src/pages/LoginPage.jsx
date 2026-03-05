import { useEffect, useMemo, useState } from "react";
import "./LoginPage.css";
import { hasRole, persistSession } from "../auth/session";

const LOGIN_GUARD_KEY = "zxc_login_guard_v1";
const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hasControlCharacters(value) {
  return /[\u0000-\u001f\u007f]/.test(String(value || ""));
}

function readLoginGuard() {
  try {
    const raw = localStorage.getItem(LOGIN_GUARD_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLoginGuard(map) {
  try {
    localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors and keep the app functional.
  }
}

function getLockoutUntil(normalizedEmail) {
  if (!normalizedEmail) {
    return 0;
  }

  const guard = readLoginGuard();
  const entry = guard[normalizedEmail];
  if (!entry || typeof entry !== "object") {
    return 0;
  }

  const blockedUntil = Number(entry.blockedUntil || 0);
  const now = Date.now();

  if (!Number.isFinite(blockedUntil) || blockedUntil <= now) {
    delete guard[normalizedEmail];
    writeLoginGuard(guard);
    return 0;
  }

  return blockedUntil;
}

function clearFailedAttempts(normalizedEmail) {
  if (!normalizedEmail) {
    return;
  }

  const guard = readLoginGuard();
  if (!guard[normalizedEmail]) {
    return;
  }

  delete guard[normalizedEmail];
  writeLoginGuard(guard);
}

function registerFailedAttempt(normalizedEmail) {
  const guard = readLoginGuard();
  const now = Date.now();

  const current =
    guard[normalizedEmail] && typeof guard[normalizedEmail] === "object"
      ? guard[normalizedEmail]
      : {};

  const currentBlockedUntil = Number(current.blockedUntil || 0);
  if (currentBlockedUntil > now) {
    return {
      failedCount: MAX_FAILED_ATTEMPTS,
      blockedUntil: currentBlockedUntil,
    };
  }

  const failedCount = Number(current.failedCount || 0) + 1;
  let blockedUntil = 0;
  let persistedFailedCount = failedCount;

  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    blockedUntil = now + LOCKOUT_DURATION_MS;
    persistedFailedCount = 0;
  }

  guard[normalizedEmail] = {
    failedCount: persistedFailedCount,
    blockedUntil,
  };
  writeLoginGuard(guard);

  return {
    failedCount,
    blockedUntil,
  };
}

function validateCredentials(normalizedEmail, password) {
  if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return "Enter a valid email.";
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return "Enter a valid email.";
  }

  if (!password) {
    return "Enter your password.";
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password is too long (max ${MAX_PASSWORD_LENGTH} characters).`;
  }

  if (hasControlCharacters(password)) {
    return "Password contains unsupported control characters.";
  }

  return "";
}

function formatRemainingTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState(0);
  const [remainingLockoutSeconds, setRemainingLockoutSeconds] = useState(0);

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  useEffect(() => {
    setLockoutUntil(getLockoutUntil(normalizedEmail));
  }, [normalizedEmail]);

  useEffect(() => {
    if (!lockoutUntil) {
      setRemainingLockoutSeconds(0);
      return undefined;
    }

    const updateCountdown = () => {
      const remainingMs = lockoutUntil - Date.now();
      if (remainingMs <= 0) {
        setRemainingLockoutSeconds(0);
        setLockoutUntil(0);
        clearFailedAttempts(normalizedEmail);
        return;
      }

      setRemainingLockoutSeconds(Math.ceil(remainingMs / 1000));
    };

    updateCountdown();
    const timerId = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timerId);
  }, [lockoutUntil, normalizedEmail]);

  const isLocked = remainingLockoutSeconds > 0;
  const lockoutMessage = isLocked
    ? `Too many failed attempts. Try again in ${formatRemainingTime(remainingLockoutSeconds)}.`
    : "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (isLocked) {
      return;
    }

    const validationError = validateCredentials(normalizedEmail, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Clients/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const attemptState = registerFailedAttempt(normalizedEmail);
          if (attemptState.blockedUntil > 0) {
            setLockoutUntil(attemptState.blockedUntil);
            const lockSeconds = Math.ceil(
              (attemptState.blockedUntil - Date.now()) / 1000,
            );
            setError(
              `Account locked for ${formatRemainingTime(Math.max(lockSeconds, 0))}.`,
            );
          } else {
            const attemptsLeft = Math.max(
              0,
              MAX_FAILED_ATTEMPTS - attemptState.failedCount,
            );
            setError(
              `Invalid email or password. Attempts left: ${attemptsLeft}.`,
            );
          }
        } else if (response.status === 429) {
          setError("Too many requests. Try again later.");
        } else {
          setError("Login failed. Try again.");
        }

        return;
      }

      clearFailedAttempts(normalizedEmail);
      const payload = await response.text().catch(() => "");
      persistSession(payload);
      window.location.href = hasRole("Administrator") ? "/admin" : "/accounts";
    } catch {
      setError("Login failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Login</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="user@email.com"
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              maxLength={MAX_EMAIL_LENGTH}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="********"
              required
              autoComplete="current-password"
              maxLength={MAX_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button type="submit" disabled={isSubmitting || isLocked}>
            {isSubmitting
              ? "Signing in..."
              : isLocked
                ? `Locked (${formatRemainingTime(remainingLockoutSeconds)})`
                : "Sign in"}
          </button>
        </form>

        <p className="switch-link">
          No account?{" "}
          <span onClick={() => (window.location.href = "/register")}>Create one</span>
        </p>
        {lockoutMessage && <p className="lockout-text">{lockoutMessage}</p>}
        {!lockoutMessage && error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
