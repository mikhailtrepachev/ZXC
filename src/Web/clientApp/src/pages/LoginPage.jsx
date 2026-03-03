import { useState } from "react";
import "./LoginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const response = await fetch("/api/Users/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  credentials: "include",
  body: JSON.stringify({
    email,
    password
  })
});

    if (!response.ok) {
      setError("Неверный логин или пароль");
      return;
    }

    window.location.href = "/";
  };

  return (
  <div className="login-container">
    <div className="login-card">
      <h2>Sign in</h2>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            placeholder="example@mail.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit">Login</button>
      </form>
        <p className="switch-link">
        Don’t have an account?{" "}
        <span onClick={() => (window.location.href = "/register")}>
            Create one
        </span>
        </p>
      {error && <p className="error-text">{error}</p>}
    </div>
  </div>
);
}