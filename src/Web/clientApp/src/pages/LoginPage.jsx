import { useState } from "react";

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

    // если используется cookie-auth — больше ничего не нужно
    // если JWT — можно сохранить токен:
    // const data = await response.json();
    // localStorage.setItem("token", data.accessToken);

    window.location.href = "/";
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto" }}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">Login</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}