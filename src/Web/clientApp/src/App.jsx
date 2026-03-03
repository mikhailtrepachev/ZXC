import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CreateAccountPage from "./pages/CreateAccountPage";


function App() {
  return (
    <BrowserRouter>
        <Header />
        <Routes>

          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<CreateAccountPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
