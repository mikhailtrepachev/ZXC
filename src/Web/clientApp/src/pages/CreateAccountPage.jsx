import { useState } from "react";
import "./CreateAccountPage.css";
import { persistSession, saveLocalUserProfile } from "../auth/session";

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

async function extractApiError(response, fallback) {
  try {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = await response.json();

      if (typeof payload === "string" && payload.trim()) {
        return payload;
      }

      if (payload?.detail) {
        return payload.detail;
      }

      if (payload?.title) {
        return payload.title;
      }

      if (payload?.errors && typeof payload.errors === "object") {
        const firstKey = Object.keys(payload.errors)[0];
        const firstError = payload.errors[firstKey]?.[0];

        if (firstError) {
          return firstError;
        }
      }
    }

    const text = await response.text();
    if (text?.trim()) {
      return text;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export default function CreateAccountPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setError("Vyplnte jmeno i prijmeni.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Hesla se neshoduji.");
      return;
    }

    if (!PASSWORD_POLICY_REGEX.test(password)) {
      setError(
        "Heslo musi mit alespon 6 znaku, velke i male pismeno, cislo a specialni znak (napr. _, !, @)."
      );
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/Clients/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        password,
      }),
    });

    if (!response.ok) {
      const apiError = await extractApiError(response, "Registrace se nezdarila.");
      setError(apiError);
      setIsSubmitting(false);
      return;
    }

    saveLocalUserProfile({
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    });

    const loginResponse = await fetch("/api/Clients/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    });

    if (loginResponse.ok) {
      const payload = await loginResponse.text().catch(() => "");
      persistSession(payload);
      window.location.href = "/accounts";
      return;
    }

    setSuccess("Ucet byl uspesne vytvoren v databazi. Nyni se prihlaste.");
    setIsSubmitting(false);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Vytvoreni uctu</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Jmeno</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Prijmeni</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label>E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Heslo</label>
            <input
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="password-hint">
              Min. 6 znaku: velke + male pismeno, cislo, specialni znak (napr. _, !, @).
            </p>
          </div>

          <div className="input-group">
            <label>Potvrzeni hesla</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registruji..." : "Registrovat"}
          </button>
        </form>

        <p className="switch-link">
          Uz mate ucet?{" "}
          <span onClick={() => (window.location.href = "/login")}>Zpet na prihlaseni</span>
        </p>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}
      </div>
    </div>
  );
}
