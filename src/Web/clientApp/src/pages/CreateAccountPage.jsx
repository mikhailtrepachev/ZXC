import { useState } from "react";
import "./CreateAccountPage.css";

export default function CreateAccountPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Hesla se neshodují.");
      return;
    }

    const response = await fetch("/api/Users/register", {
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
      setError("Registrace se nezdařila.");
      return;
    }

    setSuccess("Účet byl úspěšně vytvořen.");
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2>Vytvoření účtu</h2>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Heslo</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Potvrzení hesla</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button type="submit">Registrovat</button>
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
