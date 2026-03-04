import { useState } from "react";
import "./CreateAccountPage.css";
import { getAccessToken, persistSession, saveLocalUserProfile } from "../auth/session";

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

function extractAccounts(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const directCandidates = [
    payload.accounts,
    payload.Accounts,
    payload.clientAccounts,
    payload.ClientAccounts,
  ];

  for (const value of directCandidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  const objectValues = Object.values(payload);
  for (const value of objectValues) {
    if (!Array.isArray(value) || value.length === 0) {
      continue;
    }

    const first = value[0];
    if (first && typeof first === "object" && ("accountNumber" in first || "AccountNumber" in first)) {
      return value;
    }
  }

  return [];
}

async function waitForGeneratedAccounts() {
  const token = getAccessToken();
  if (!token) {
    return false;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch("/api/Accounts/info", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null);
        const accounts = extractAccounts(payload);
        if (accounts.length > 0) {
          return true;
        }
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return false;
}

export default function CreateAccountPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [stateName, setStateName] = useState("");
  const [street, setStreet] = useState("");
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
    const normalizedPhoneNumber = phoneNumber.trim();
    const normalizedStateName = stateName.trim();
    const normalizedStreet = street.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setError("Vyplňte jméno i příjmení.");
      return;
    }

    if (!normalizedPhoneNumber) {
      setError("Vyplňte telefonní číslo.");
      return;
    }

    if (!/^\+?[0-9\s\-()]{7,20}$/.test(normalizedPhoneNumber)) {
      setError("Zadejte platné telefonní číslo.");
      return;
    }

    if (!normalizedStateName || !normalizedStreet) {
      setError("Vyplňte stát a ulici.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Hesla se neshoduji.");
      return;
    }

    if (!PASSWORD_POLICY_REGEX.test(password)) {
      setError(
        "Heslo musí mít alespoň 6 znaků, velké i malé písmeno, číslo a speciální znak (např. _, !, @)."
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
        phoneNumber: normalizedPhoneNumber,
        state: normalizedStateName,
        street: normalizedStreet,
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
      await waitForGeneratedAccounts();
      window.location.href = "/accounts";
      return;
    }

    setSuccess("Účet byl úspěšně vytvořen v databázi. Nyní se přihlaste.");
    setIsSubmitting(false);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Vytvoření účtu</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Jméno</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Příjmení</label>
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
            <label>Telefon</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+420 123 456 789"
            />
          </div>

          <div className="input-group">
            <label>Stát</label>
            <input
              type="text"
              required
              value={stateName}
              onChange={(event) => setStateName(event.target.value)}
              placeholder="Česká republika"
            />
          </div>

          <div className="input-group">
            <label>Ulice</label>
            <input
              type="text"
              required
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              placeholder="Hlavní 123"
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
              Min. 6 znaků: velké + malé písmeno, číslo, speciální znak (např. _, !, @).
            </p>
          </div>

          <div className="input-group">
            <label>Potvrzení hesla</label>
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
          Už máte účet?{" "}
          <span onClick={() => (window.location.href = "/login")}>Zpět na přihlášení</span>
        </p>

        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}
      </div>
    </div>
  );
}
