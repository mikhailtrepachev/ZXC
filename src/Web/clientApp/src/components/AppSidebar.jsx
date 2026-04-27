"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronUp,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Shield,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Link, useNavigate } from "../routing";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import ThemeToggle from "./ThemeToggle";
import {
  AUTH_CHANGED_EVENT,
  clearSession,
  getAccessToken,
  getCurrentUserFromToken,
  hasRole,
  logoutUser,
  resolveUserDisplayNameByEmail,
} from "../auth/session";
import { formatDate, pick, readErrorMessage, transactionIsIncome } from "../lib/bank";

const platformItems = [
  { title: "Dashboard", href: "/accounts", icon: LayoutDashboard },
  { title: "Cards", href: "/cards", icon: CreditCard },
  { title: "Loans", href: "/loans", icon: WalletCards },
  { title: "Payments", href: "/payments", icon: Send },
  { title: "Stocks", href: "/stocks", icon: TrendingUp },
];

const accountItems = [
  { title: "Settings", href: "/user-settings", icon: Settings },
];

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <SidebarMenuButton
      type="button"
      onClick={toggleSidebar}
      tooltip={isCollapsed ? "Open sidebar" : "Collapse sidebar"}
      className="border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground hover:bg-sidebar-accent"
    >
      <Icon />
      <span>{isCollapsed ? "Open menu" : "Collapse menu"}</span>
    </SidebarMenuButton>
  );
}

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

export default function AppSidebar() {
  const navigate = useNavigate();
  const pathname = usePathname() || "/";
  const [currentUser, setCurrentUser] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsMode, setNotificationsMode] = useState("none");

  const cabinetLabel = currentUser || "Internet banking";
  const currentUserKey = useMemo(() => normalizeUserKey(getCurrentUserFromToken() || cabinetLabel), [cabinetLabel]);
  const unreadCount = useMemo(
    () => notifications.reduce((sum, item) => sum + (item.isRead ? 0 : 1), 0),
    [notifications],
  );

  const resetAuthState = useCallback(() => {
    setCurrentUser("");
    setIsAuthorized(false);
    setIsAdmin(false);
    setNotifications([]);
    setNotificationsError("");
    setNotificationsMode("none");
  }, []);

  const loadCurrentUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      resetAuthState();
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

        if (response.status === 401 || response.status === 403) {
          clearSession();
          resetAuthState();
          return;
        }

        if (!response.ok) {
          continue;
        }

        const payload = await response.json().catch(() => null);
        const userLabel = resolveUserLabel(payload);
        const tokenUser = getCurrentUserFromToken();

        setCurrentUser(userLabel || tokenUser || "User");
        setIsAuthorized(true);
        setIsAdmin(hasRole("Administrator"));
        return;
      } catch {
        // Try the next endpoint.
      }
    }

    clearSession();
    resetAuthState();
  }, [resetAuthState]);

  useEffect(() => {
    loadCurrentUser();
    window.addEventListener(AUTH_CHANGED_EVENT, loadCurrentUser);
    window.addEventListener("storage", loadCurrentUser);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, loadCurrentUser);
      window.removeEventListener("storage", loadCurrentUser);
    };
  }, [loadCurrentUser]);

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
  }, [currentUserKey, isAuthorized, loadNotifications]);

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
    resetAuthState();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="ZXC Bank">
              <Link to="/accounts" className="no-underline">
                <span className="flex size-8 items-center justify-center bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-semibold">ZXC Bank</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Internet Banking</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarToggleButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.href} className="no-underline">
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAuthorized && (
                <DropdownMenu>
                  <SidebarMenuItem>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton tooltip="Notifications">
                        <Bell />
                        <span>Notifications</span>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    {unreadCount > 0 && (
                      <SidebarMenuBadge>{unreadCount > 99 ? "99+" : unreadCount}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                  <DropdownMenuContent side="right" align="start" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between gap-3">
                      <span>Notifications</span>
                      <Button
                        variant="ghost"
                        size="xs"
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
                        <DropdownMenuItem
                          key={item.id}
                          onSelect={() => handleMarkNotificationRead(item)}
                          className="items-start normal-case tracking-normal"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className={item.isRead ? "text-muted-foreground" : "font-medium"}>{item.message}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(item.createdAt, true)}</span>
                          </span>
                          {!item.isRead && <span className="mt-1 size-2 bg-primary" />}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {accountItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.href} className="no-underline">
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} tooltip="Admin">
                    <Link to="/admin" className="no-underline">
                      <Shield />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center">
          <ThemeToggle />
          <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
            Theme
          </span>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Products">
              <Link to="/loans" className="no-underline">
                <Landmark />
                <span>Products</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {isAuthorized && (
            <DropdownMenu>
              <SidebarMenuItem>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip={cabinetLabel}>
                    <UserRound />
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">{cabinetLabel}</span>
                      <span className="truncate text-xs text-sidebar-foreground/70">User profile</span>
                    </span>
                    <ChevronUp className="ml-auto group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
              </SidebarMenuItem>
              <DropdownMenuContent side="right" align="end" className="w-56">
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
          )}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
