"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, LockKeyhole, Mail } from "lucide-react";
import { hasRole, persistSession } from "../auth/session";
import { useNavigate } from "../routing";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { StateMessage } from "../components/PageScaffold";

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
  return Array.from(String(value || "")).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function readLoginGuard() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(LOGIN_GUARD_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLoginGuard(map) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(map));
  } catch {
    // Storage can be unavailable in private modes.
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
  const current = guard[normalizedEmail] && typeof guard[normalizedEmail] === "object" ? guard[normalizedEmail] : {};
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
  if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
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
  const navigate = useNavigate();
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
            const lockSeconds = Math.ceil((attemptState.blockedUntil - Date.now()) / 1000);
            setError(`Account locked for ${formatRemainingTime(Math.max(lockSeconds, 0))}.`);
          } else {
            const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - attemptState.failedCount);
            setError(`Invalid email or password. Attempts left: ${attemptsLeft}.`);
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
      navigate(hasRole("Administrator") ? "/admin" : "/accounts", { replace: true });
    } catch {
      setError("Login failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-muted/30 px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="hidden flex-col justify-between rounded-lg border bg-card p-8 shadow-sm lg:flex">
          <div className="space-y-5">
            <div className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="size-6" />
            </div>
            <div className="space-y-3">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight">Secure banking</h1>
              <p className="max-w-lg text-muted-foreground">
                Access accounts, cards, payments, notifications, and admin workflows from one responsive interface.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">ZXC Bank Internet Banking</p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your ZXC Bank credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
              <div className="grid gap-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="user@email.com"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="email"
                    maxLength={MAX_EMAIL_LENGTH}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="********"
                    autoComplete="current-password"
                    maxLength={MAX_PASSWORD_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || isLocked} className="w-full">
                {isSubmitting ? "Signing in..." : isLocked ? `Locked (${formatRemainingTime(remainingLockoutSeconds)})` : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 grid gap-3">
              {lockoutMessage && <StateMessage type="warning">{lockoutMessage}</StateMessage>}
              {!lockoutMessage && error && <StateMessage type="error">{error}</StateMessage>}
              <p className="text-center text-sm text-muted-foreground">
                No account?{" "}
                <button className="font-medium text-primary hover:underline" type="button" onClick={() => navigate("/register")}>
                  Create one
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
