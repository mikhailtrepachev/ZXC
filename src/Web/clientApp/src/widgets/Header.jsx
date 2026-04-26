"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Building2, CreditCard, Home, LogIn, LogOut, Menu, Settings, Shield, UserRound, WalletCards } from "lucide-react";
import { Link, useNavigate } from "../routing";
import {
  getAccessToken,
  getCurrentUserFromToken,
  hasRole,
  logoutUser,
  resolveUserDisplayNameByEmail,
} from "../auth/session";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Separator } from "../components/ui/separator";
import { formatDate, pick, readErrorMessage, transactionIsIncome } from "../lib/bank";
import ThemeToggle from "../components/ThemeToggle";

const NAV = [
  { label: "Dashboard", href: "/accounts", icon: Home },
  { label: "Cards", href: "/cards", icon: CreditCard },
  { label: "Loans", href: "/loans", icon: WalletCards },
  { label: "Payments", href: "/payments", icon: Building2 },
];

const FALLBACK_NOTIFICATION_KEY = "zxc_fallback_notifications_read";

function readFallbackStorage() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(FALLBACK_NOTIFICATION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeFallbackStorage(value) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(FALLBACK_NOTIFICATION_KEY, JSON.stringify(value));
}

function normalizeUserKey(value) {
  return String(value || "").trim().toLowerCase();
}

function getFallbackReadIds(userKey) {
  const normalized = normalizeUserKey(userKey);
  if (!normalized) {
    return [];
  }

  const storage = readFallbackStorage();
  const value = storage[normalized];
  return Array.isArray(value) ? value.map((id) => String(id)) : [];
}

function setFallbackReadIds(userKey, ids) {
  const normalized = normalizeUserKey(userKey);
  if (!normalized) {
    return;
  }

  const storage = readFallbackStorage();
  storage[normalized] = Array.from(new Set(ids.map((id) => String(id))));
  writeFallbackStorage(storage);
}

function resolveUserLabel(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const email = pick(payload, "email", "Email", "userName", "UserName", "username") || "";
  const raw = pick(payload, "fullName", "FullName", "name", "Name", "email", "Email", "userName", "UserName") || "";

  return resolveUserDisplayNameByEmail(email, String(raw).trim());
}

function mapApiNotification(item) {
  const id = Number(pick(item, "id", "Id"));
  const message = String(pick(item, "message", "Message", "text", "Text") || "").trim();
  const createdAt = pick(item, "createdAt", "CreatedAt", "created", "Created", "date", "Date");
  const isRead = Boolean(pick(item, "isRead", "IsRead"));

  if (!Number.isFinite(id) || !message) {
    return null;
  }

  return {
    id: `srv-${id}`,
    serverId: id,
    message,
    createdAt: createdAt || null,
    isRead,
    source: "server",
  };
}

function mapTransactionToNotification(item, readSet) {
  const id = Number(pick(item, "id", "Id"));
  if (!Number.isFinite(id)) {
    return null;
  }

  const income = transactionIsIncome(pick(item, "type", "Type"));
  const amount = Number(pick(item, "amount", "Amount"));
  const absolute = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const description = String(pick(item, "description", "Description") || "").trim();
  const date = pick(item, "date", "Date");
  const localId = `tx-${id}`;

  return {
    id: localId,
    serverId: id,
    message: `${description || (income ? "Incoming transfer" : "Outgoing transfer")} - ${income ? "+" : "-"}${absolute.toLocaleString("cs-CZ")} Kc`,
    createdAt: date || null,
    isRead: readSet.has(localId),
    source: "fallback",
  };
}

export default function Header() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsMode, setNotificationsMode] = useState("none");

  const cabinetLabel = currentUser || "Internet banking";
  const currentUserKey = normalizeUserKey(getCurrentUserFromToken() || cabinetLabel);
  const unreadCount = useMemo(
    () => notifications.reduce((sum, item) => sum + (item.isRead ? 0 : 1), 0),
    [notifications],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      const token = getAccessToken();
      if (!token) {
        if (isMounted) {
          setCurrentUser("");
          setIsAuthorized(false);
          setIsAdmin(false);
        }
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const endpoints = ["/api/Accounts/info", "/api/Users/manage/info"];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            credentials: "include",
            headers,
          });

          if (!response.ok) {
            continue;
          }

          const payload = await response.json().catch(() => null);
          const userLabel = resolveUserLabel(payload);

          if (isMounted) {
            setCurrentUser(userLabel || getCurrentUserFromToken() || "User");
            setIsAuthorized(true);
            setIsAdmin(hasRole("Administrator"));
          }
          return;
        } catch {
          // Try the next endpoint.
        }
      }

      if (isMounted) {
        setCurrentUser(String(getCurrentUserFromToken() || "User").trim());
        setIsAuthorized(true);
        setIsAdmin(hasRole("Administrator"));
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!isAuthorized) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setNotifications([]);
      setNotificationsMode("none");
      return;
    }

    setNotificationsLoading(true);
    setNotificationsError("");
    const headers = { Authorization: `Bearer ${token}` };
    const listEndpoints = [
      "/api/Notifications/list",
      "/api/Notifications",
      "/api/Notification/list",
      "/api/Notification",
    ];

    for (const endpoint of listEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            continue;
          }
          break;
        }

        const payload = await response.json().catch(() => []);
        const list = Array.isArray(payload) ? payload.map(mapApiNotification).filter(Boolean) : [];
        setNotifications(list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
        setNotificationsMode("server");
        setNotificationsLoading(false);
        return;
      } catch {
        // Try the next endpoint.
      }
    }

    try {
      const fallbackResponse = await fetch("/api/Transaction/history", {
        method: "GET",
        credentials: "include",
        headers,
      });

      if (!fallbackResponse.ok) {
        setNotifications([]);
        setNotificationsMode("none");
        setNotificationsError(await readErrorMessage(fallbackResponse, "Notifications are unavailable."));
        return;
      }

      const payload = await fallbackResponse.json().catch(() => []);
      const readSet = new Set(getFallbackReadIds(currentUserKey));
      const fallbackItems = Array.isArray(payload)
        ? payload.map((item) => mapTransactionToNotification(item, readSet)).filter(Boolean)
        : [];

      setNotifications(fallbackItems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      setNotificationsMode("fallback");
    } catch {
      setNotifications([]);
      setNotificationsMode("none");
      setNotificationsError("Notifications are unavailable.");
    } finally {
      setNotificationsLoading(false);
    }
  }, [currentUserKey, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) {
      setNotifications([]);
      setNotificationsError("");
      setNotificationsMode("none");
      return undefined;
    }

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 45000);

    return () => window.clearInterval(intervalId);
  }, [isAuthorized, currentUserKey, loadNotifications]);

  const handleMarkNotificationRead = async (notification) => {
    if (!notification || notification.isRead) {
      return;
    }

    if (notification.source === "fallback") {
      const nextReadIds = new Set(getFallbackReadIds(currentUserKey));
      nextReadIds.add(notification.id);
      setFallbackReadIds(currentUserKey, Array.from(nextReadIds));
      setNotifications((previous) =>
        previous.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );
      return;
    }

    const token = getAccessToken();
    if (!token || !Number.isFinite(notification.serverId)) {
      return;
    }

    const markReadEndpoints = [
      `/api/Notifications/mark-read/${notification.serverId}`,
      `/api/Notifications/${notification.serverId}/read`,
      `/api/Notification/mark-read/${notification.serverId}`,
      `/api/Notification/${notification.serverId}/read`,
    ];

    for (const endpoint of markReadEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            continue;
          }
          break;
        }

        setNotifications((previous) =>
          previous.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
        );
        return;
      } catch {
        // Try the next endpoint.
      }
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const unread = notifications.filter((item) => !item.isRead);
    if (unread.length === 0) {
      return;
    }

    if (notificationsMode === "fallback") {
      const nextReadIds = new Set(getFallbackReadIds(currentUserKey));
      for (const item of unread) {
        nextReadIds.add(item.id);
      }
      setFallbackReadIds(currentUserKey, Array.from(nextReadIds));
    }

    setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true })));
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser("");
    setIsAuthorized(false);
    setIsAdmin(false);
    setNotifications([]);
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2 no-underline" to="/accounts" aria-label="ZXC Bank">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">ZXC Bank</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} variant="ghost" asChild>
                <Link to={item.href} className="no-underline">
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
          {isAdmin && (
            <Button variant="ghost" asChild>
              <Link to="/admin" className="no-underline">
                <Shield className="size-4" />
                Admin
              </Link>
            </Button>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {isAuthorized ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="size-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -right-2 -top-2 h-5 min-w-5 px-1 text-[10px]">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      disabled={unreadCount === 0}
                    >
                      Mark all
                    </Button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notificationsLoading && <p className="px-2 py-4 text-sm text-muted-foreground">Loading...</p>}
                  {!notificationsLoading && notificationsError && (
                    <p className="px-2 py-4 text-sm text-destructive">{notificationsError}</p>
                  )}
                  {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                    <p className="px-2 py-4 text-sm text-muted-foreground">No recent events.</p>
                  )}
                  {!notificationsLoading &&
                    !notificationsError &&
                    notifications.slice(0, 8).map((item) => (
                      <DropdownMenuItem key={item.id} onSelect={() => handleMarkNotificationRead(item)} className="items-start">
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className={item.isRead ? "text-muted-foreground" : "font-medium"}>{item.message}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(item.createdAt, true)}</span>
                        </span>
                        {!item.isRead && <span className="mt-1 size-2 rounded-full bg-primary" />}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="hidden sm:inline-flex">
                    <UserRound className="size-4" />
                    <span className="max-w-40 truncate">{cabinetLabel}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{cabinetLabel}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/user-settings")}>
                    <Settings className="size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                <LogIn className="size-4" />
                Login
              </Button>
              <Button onClick={() => navigate("/register")}>Open account</Button>
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Navigation</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} onSelect={() => navigate(item.href)}>
                    <Icon className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
              {isAdmin && (
                <DropdownMenuItem onSelect={() => navigate("/admin")}>
                  <Shield className="size-4" />
                  Admin
                </DropdownMenuItem>
              )}
              <Separator className="my-1" />
              {isAuthorized ? (
                <>
                  <DropdownMenuItem onSelect={() => navigate("/user-settings")}>
                    <Settings className="size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="size-4" />
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => navigate("/login")}>Login</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/register")}>Open account</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
