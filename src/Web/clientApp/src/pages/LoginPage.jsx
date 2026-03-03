import { useState } from "react";
import "./LoginPage.css";
import { persistSession } from "../auth/session";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

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
      setError("Neplatný e-mail nebo heslo.");
      return;
    }

    const payload = await response.text().catch(() => "");
    persistSession(payload);

    window.location.href = "/accounts";
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
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Heslo</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit">Přihlásit se</button>
        </form>

        <p className="switch-link">
          Nemáte účet?{" "}
          <span onClick={() => (window.location.href = "/register")}>Vytvořit účet</span>
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
