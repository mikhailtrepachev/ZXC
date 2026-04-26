"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSession,
  hasRole,
  isAuthenticated as checkAuthentication,
} from "../auth/session";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    checkAuthentication()
      .then((authenticated) => {
        if (!isMounted) return;

        if (!authenticated) {
          clearSession();
          router.replace("/login");
          return;
        }

        if (requireAdmin && !hasRole("Administrator")) {
          router.replace("/accounts");
          return;
        }

        setIsAuthenticated(true);
      })
      .catch(() => {
        if (!isMounted) return;
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requireAdmin, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let timeoutId = null;

    const startIdleTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        clearSession();
        setIsAuthenticated(false);
        router.replace("/login");
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
  }, [isAuthenticated, router]);

  if (isChecking || !isAuthenticated) {
    return <div />;
  }

  return children;
}
