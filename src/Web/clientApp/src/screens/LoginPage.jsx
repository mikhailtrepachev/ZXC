"use client";

import { useMemo, useState } from "react";
import { Building2, LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import { hasRole, persistSession } from "../auth/session";
import { useNavigate } from "../routing";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { StateMessage } from "../components/PageScaffold";
import { readErrorMessage } from "../lib/bank";

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

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validationError = validateCredentials(normalizedEmail, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Clients/login", {
        method: "POST",
        credentials: "include",
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
          setError("Invalid email or password.");
          return;
        }

        setError(await readErrorMessage(response, "Login failed. Try again."));
        return;
      }

      const payload = await response.json().catch(() => null);
      const saved = persistSession(payload);
      if (!saved) {
        setError("Login response did not contain a valid server session.");
        return;
      }

      navigate(hasRole("Administrator") ? "/admin" : "/accounts", { replace: true });
    } catch {
      setError("Login failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 items-start bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => navigate("/login")}>
            <LogIn className="size-4" />
            Login
          </Button>
          <Button type="button" onClick={() => navigate("/register")}>
            <UserPlus className="size-4" />
            Open account
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
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

                <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer">
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="mt-4 grid gap-3">
                {error && <StateMessage type="error">{error}</StateMessage>}
                <p className="text-center text-sm text-muted-foreground">
                  No account?{" "}
                  <button className="font-medium text-primary hover:underline cursor-pointer" type="button" onClick={() => navigate("/register")}>
                    Create one
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
