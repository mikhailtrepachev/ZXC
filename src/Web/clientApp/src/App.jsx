import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CreateAccountPage from "./pages/CreateAccountPage";
import AdminPage from "./pages/AdminPage";
import AccountsPage from "./pages/AccountsPage";
import AccountDetailsPage from "./pages/AccountDetailsPage";
import AccountConversionPage from "./pages/AccountConversionPage";
import CardsPage from "./pages/CardsPage";
import CardDetailsPage from "./pages/CardDetailsPage";
import LoansPage from "./pages/LoansPage";
import PaymentsPage from "./pages/PaymentsPage";
import UserSettingsPage from "./pages/UserSettingsPage";
import Header from "./widgets/Header.jsx";
import Footer from "./widgets/Footer.jsx";
import {
  clearSession,
  hasRole,
  isAuthenticated as checkAuthentication,
} from "./auth/session";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

function ProtectedRoute({ children, requireAdmin = false }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    checkAuthentication()
      .then((authenticated) => {
        if (!isMounted) return;
        setIsAuthenticated(authenticated);
        setIsAdmin(authenticated ? hasRole("Administrator") : false);
        if (!authenticated) clearSession();
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAuthenticated(false);
        setIsAdmin(false);
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

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let timeoutId = null;

    const startIdleTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        clearSession();
        setTimedOut(true);
        setIsAuthenticated(false);
        setIsAdmin(false);
      }, IDLE_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startIdleTimer();
      }
    };

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, startIdleTimer, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    startIdleTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      for (const eventName of IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, startIdleTimer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated]);

  if (isChecking) return <div />;
  if (timedOut) return <Navigate to="/login" replace />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/accounts" replace />;

  return children;
}

function HomeRoute() {
  return <Navigate to={hasRole("Administrator") ? "/admin" : "/accounts"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomeRoute />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts"
          element={
            <ProtectedRoute>
              <AccountsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/:accountNumber"
          element={
            <ProtectedRoute>
              <AccountDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/:accountNumber/conversion"
          element={
            <ProtectedRoute>
              <AccountConversionPage />
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

        <Route
          path="/cards/:cardId"
          element={
            <ProtectedRoute>
              <CardDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/loans"
          element={
            <ProtectedRoute>
              <LoansPage />
            </ProtectedRoute>
          }
        />

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
