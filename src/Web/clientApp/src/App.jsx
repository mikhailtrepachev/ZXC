import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CreateAccountPage from "./pages/CreateAccountPage";
import AccountsPage from "./pages/AccountsPage";
import CardsPage from "./pages/CardsPage";
import LoansPage from "./pages/LoansPage";
import PaymentsPage from "./pages/PaymentsPage";
import UserSettingsPage from "./pages/UserSettingsPage";
import Header from "./widgets/Header.jsx";
import Footer from "./widgets/Footer.jsx";
import {
  clearSession,
  isAuthenticated as checkAuthentication,
} from "./auth/session";

function ProtectedRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    checkAuthentication()
      .then((authenticated) => {
        if (!isMounted) return;
        setIsAuthenticated(authenticated);
        if (!authenticated) clearSession();
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthenticated(false);
        clearSession();
      })
      .finally(() => {
        if (!isMounted) return;
        setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isChecking) return <div />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Navigate to="/accounts" />} />

        <Route
          path="/accounts"
          element={
            <ProtectedRoute>
              <AccountsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cards"
          element={
            <ProtectedRoute>
              <CardsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/loans" element={<LoansPage />} />

        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/user-settings"
          element={
            <ProtectedRoute>
              <UserSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<CreateAccountPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
