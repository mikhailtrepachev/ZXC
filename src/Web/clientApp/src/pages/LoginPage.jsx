import { useState } from "react";
import "./LoginPage.css";
import { hasRole, persistSession } from "../auth/session";

async function extractApiError(response, fallback) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);

    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }

    if (payload?.detail) {
      return payload.detail;
    }

    if (payload?.title) {
      return payload.title;
    }
  }

  const text = await response.text().catch(() => "");
  return text?.trim() ? text : fallback;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/Clients/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const apiError = await extractApiError(
          response,
          "Neplatný e-mail nebo heslo.",
        );
        setError(apiError);
        return;
      }

      const payload = await response.text().catch(() => "");
      persistSession(payload);
      window.location.href = hasRole("Administrator") ? "/admin" : "/accounts";
    } catch {
      setError("Přihlášení se nepodařilo. Zkuste to znovu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Přihlášení</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="uzivatel@email.cz"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Heslo</label>
            <input
              type="password"
              placeholder="********"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Přihlašuji..." : "Přihlásit se"}
          </button>
        </form>

        <p className="switch-link">
          Nemáte účet?{" "}
          <span onClick={() => (window.location.href = "/register")}>
            Vytvořit účet
          </span>
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
