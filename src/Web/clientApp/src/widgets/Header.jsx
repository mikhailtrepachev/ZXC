import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAccessToken,
  getCurrentUserFromToken,
  logoutUser,
  resolveUserDisplayNameByEmail,
} from "../auth/session";
import "./header_style.css";

const NAV = [
  { label: "Účty", href: "/accounts" },
  { label: "Karty", href: "/cards" },
  { label: "Úvěry", href: "/loans" },
  { label: "Platby", href: "/payments" },
];

const LOGO_URL = "https://i.ytimg.com/vi/TiE9pWAwYOs/maxresdefault.jpg";
const FALLBACK_NOTIFICATION_KEY = "zxc_fallback_notifications_read";

function readFallbackStorage() {
  try {
    const raw = localStorage.getItem(FALLBACK_NOTIFICATION_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFallbackStorage(value) {
  localStorage.setItem(FALLBACK_NOTIFICATION_KEY, JSON.stringify(value));
}

function normalizeUserKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
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

function pick(obj, ...keys) {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  return undefined;
}

function formatNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function transactionIsIncome(type) {
  if (typeof type === "string") {
    return type.toLowerCase() === "income";
  }

  return Number(type) === 0;
}

function mapApiNotification(item) {
  const id = Number(pick(item, "id", "Id"));
  const message = String(
    pick(item, "message", "Message", "text", "Text") || "",
  ).trim();
  const createdAt = pick(
    item,
    "createdAt",
    "CreatedAt",
    "created",
    "Created",
    "date",
    "Date",
  );
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
  const counterparty = String(
    pick(item, "counterpartyAccount", "CounterpartyAccount") || "",
  ).trim();
  const description = String(
    pick(item, "description", "Description") || "",
  ).trim();
  const date = pick(item, "date", "Date");
  const message =
    description ||
    `${income ? "Příchozí převod" : "Odchozí převod"} ${counterparty ? `(${counterparty})` : ""}`.trim();
  const localId = `tx-${id}`;

  return {
    id: localId,
    serverId: id,
    message: `${message} - ${income ? "+" : "-"}${absolute.toLocaleString("cs-CZ")} Kc`,
    createdAt: date || null,
    isRead: readSet.has(localId),
    source: "fallback",
  };
}

function resolveUserLabel(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const email =
    payload.email ||
    payload.Email ||
    payload.userName ||
    payload.UserName ||
    payload.username ||
    "";

  const raw =
    payload.fullName ||
    payload.FullName ||
    payload.email ||
    payload.Email ||
    payload.userName ||
    payload.UserName ||
    payload.username ||
    payload.name ||
    payload.fullName ||
    payload.FullName ||
    "";
  if (typeof raw !== "string") {
    return "";
  }

  return resolveUserDisplayNameByEmail(email, raw.trim());
}

export default function Header() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationsMode, setNotificationsMode] = useState("none");
  const userMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      const token = getAccessToken();
      if (!token) {
        if (isMounted) {
          setCurrentUser("");
          setIsAuthorized(false);
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
            setCurrentUser(userLabel);
            setIsAuthorized(true);
          }
          return;
        } catch {
          // try next endpoint
        }
      }

      if (isMounted) {
        setCurrentUser("");
        setIsAuthorized(false);
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
      }

      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const cabinetLabel = currentUser || "Internetové bankovnictví";
  const currentUserKey = normalizeUserKey(
    getCurrentUserFromToken() || cabinetLabel,
  );
  const unreadCount = notifications.reduce(
    (sum, item) => sum + (item.isRead ? 0 : 1),
    0,
  );

  const loadNotifications = async () => {
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
        const list = Array.isArray(payload)
          ? payload.map(mapApiNotification).filter(Boolean)
          : [];
        const sorted = list.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
        setNotifications(sorted);
        setNotificationsMode("server");
        setNotificationsLoading(false);
        return;
      } catch {
        // try next endpoint
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
        setNotificationsError("Upozornění nejsou momentálně dostupná.");
        setNotificationsLoading(false);
        return;
      }

      const payload = await fallbackResponse.json().catch(() => []);
      const readSet = new Set(getFallbackReadIds(currentUserKey));
      const fallbackItems = Array.isArray(payload)
        ? payload
            .map((item) => mapTransactionToNotification(item, readSet))
            .filter(Boolean)
        : [];

      const sorted = fallbackItems.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      setNotifications(sorted);
      setNotificationsMode("fallback");
    } catch {
      setNotifications([]);
      setNotificationsMode("none");
      setNotificationsError("Upozornění nejsou momentálně dostupná.");
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) {
      setNotifications([]);
      setNotificationsError("");
      setNotificationsMode("none");
      return;
    }

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 45000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAuthorized, currentUserKey]);

  const handleMarkNotificationRead = async (notification) => {
    if (!notification || notification.isRead) {
      return;
    }

    if (notification.source === "fallback") {
      const nextReadIds = new Set(getFallbackReadIds(currentUserKey));
      nextReadIds.add(notification.id);
      setFallbackReadIds(currentUserKey, Array.from(nextReadIds));
      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
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

    const headers = { Authorization: `Bearer ${token}` };

    for (const endpoint of markReadEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            continue;
          }
          break;
        }

        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item,
          ),
        );
        return;
      } catch {
        // try next endpoint
      }
    }

    setNotificationsError("Nepodařilo se označit upozornění jako přečtené.");
  };

  const handleMarkAllNotificationsRead = async () => {
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
      setNotifications((previous) =>
        previous.map((item) => ({ ...item, isRead: true })),
      );
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    const markAllEndpoints = [
      "/api/Notifications/mark-all-read",
      "/api/Notifications/read-all",
      "/api/Notification/mark-all-read",
      "/api/Notification/read-all",
    ];

    for (const endpoint of markAllEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            continue;
          }
          break;
        }

        setNotifications((previous) =>
          previous.map((item) => ({ ...item, isRead: true })),
        );
        return;
      } catch {
        // try next endpoint
      }
    }

    setNotificationsError("Nepodařilo se označit vše jako přečtené.");
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser("");
    setIsAuthorized(false);
    setMobileOpen(false);
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setNotifications([]);
    setNotificationsError("");
    setNotificationsMode("none");
    window.location.href = "/login";
  };

  const handleUserSettings = () => {
    setUserMenuOpen(false);
    navigate("/user-settings");
  };

  return (
    <header className="site-header">
      <div className="site-header__container">
        <div className="site-header__main">
          <Link className="site-header__logo" to="/accounts" aria-label="Domu">
            <span className="site-header__logoMark" aria-hidden="true">
              <img className="site-header__logoImg" src={LOGO_URL} alt="" />
            </span>

            <span className="site-header__logoText">
              <span className="site-header__logoStrong">ZXC</span>{" "}
              <span className="site-header__logoSoft">bank</span>
            </span>
          </Link>

          <nav className="site-header__nav" aria-label="Hlavni menu">
            <ul className="site-header__navList">
              <li className="site-header__navItem">
                <details className="site-header__details">
                  <summary className="site-header__navLink site-header__summary">
                    Produkty <ChevronDown />
                  </summary>
                  <div className="site-header__dropdown">
                    <Link className="site-header__dropdownLink" to="/cards">
                      Karty
                    </Link>
                    <Link className="site-header__dropdownLink" to="/accounts">
                      Účty
                    </Link>
                    <Link className="site-header__dropdownLink" to="/loans">
                      Úvěry
                    </Link>
                    <Link className="site-header__dropdownLink" to="/payments">
                      Platby
                    </Link>
                  </div>
                </details>
              </li>

              {NAV.map((item) => (
                <li key={item.href} className="site-header__navItem">
                  <Link className="site-header__navLink" to={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            {isAuthorized ? (
              <>
                <div
                  className="site-header__notifications"
                  ref={notificationsRef}
                >
                  <button
                    className="site-header__iconButton site-header__notificationButton"
                    type="button"
                    onClick={() => {
                      setNotificationsOpen((value) => !value);
                      setUserMenuOpen(false);
                    }}
                    aria-label="Upozorneni"
                    aria-expanded={notificationsOpen}
                    aria-haspopup="menu"
                  >
                    <BellIcon />
                    {unreadCount > 0 && (
                      <span className="site-header__notificationBadge">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationsOpen && (
                    <div
                      className="site-header__notificationsDropdown"
                      role="menu"
                    >
                      <div className="site-header__notificationsHead">
                        <strong>Upozornění</strong>
                        <button
                          className="site-header__notificationsAction"
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          disabled={unreadCount === 0}
                        >
                          Označit vše
                        </button>
                      </div>

                      {notificationsLoading && (
                        <p className="site-header__notificationsState">
                          Načítám...
                        </p>
                      )}
                      {!notificationsLoading && notificationsError && (
                        <p className="site-header__notificationsState site-header__notificationsState--error">
                          {notificationsError}
                        </p>
                      )}
                      {!notificationsLoading &&
                        !notificationsError &&
                        notifications.length === 0 && (
                          <p className="site-header__notificationsState">
                            Žádné nové události.
                          </p>
                        )}

                      {!notificationsLoading &&
                        !notificationsError &&
                        notifications.length > 0 && (
                          <div className="site-header__notificationsList">
                            {notifications.slice(0, 8).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`site-header__notificationItem ${item.isRead ? "" : "is-unread"}`}
                                onClick={() => handleMarkNotificationRead(item)}
                              >
                                <span>{item.message}</span>
                                <small>
                                  {formatNotificationDate(item.createdAt)}
                                </small>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <div className="site-header__userMenu" ref={userMenuRef}>
                  <button
                    className="site-header__cabinet site-header__cabinetButton"
                    type="button"
                    onClick={() => {
                      setUserMenuOpen((value) => !value);
                      setNotificationsOpen(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                  >
                    <span className="site-header__cabinetText">
                      {cabinetLabel}
                    </span>
                    <UserIcon />
                  </button>

                  {userMenuOpen && (
                    <div className="site-header__userDropdown" role="menu">
                      <button
                        className="site-header__userDropdownButton"
                        type="button"
                        onClick={handleUserSettings}
                      >
                        Nastavení uživatele
                      </button>
                      <button
                        className="site-header__userDropdownButton"
                        type="button"
                        onClick={handleLogout}
                      >
                        Odhlásit se
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  className="site-header__button site-header__button--ghost"
                  type="button"
                  onClick={() => (window.location.href = "/login")}
                >
                  Přihlásit se
                </button>
                <button
                  className="site-header__button site-header__button--primary"
                  type="button"
                  onClick={() => (window.location.href = "/register")}
                >
                  Otevřít účet
                </button>
              </>
            )}

            <button
              className="site-header__burger"
              type="button"
              aria-label={mobileOpen ? "Zavrit menu" : "Otevrit menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>

      <div className={`mobile-menu ${mobileOpen ? "is-open" : ""}`}>
        <div className="mobile-menu__panel">
          <div className="mobile-menu__header">
            <span className="mobile-menu__title">Menu</span>
            <button
              className="site-header__iconButton"
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Zavrit"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mobile-menu__section">
            <div className="mobile-menu__label">Kategorie</div>
            <div className="mobile-menu__links">
              <a href="#private" onClick={() => setMobileOpen(false)}>
                Pro občany
              </a>
              <a href="#business" onClick={() => setMobileOpen(false)}>
                Pro podnikatele
              </a>
              <a href="#premium" onClick={() => setMobileOpen(false)}>
                Premium
              </a>
              <a href="#support" onClick={() => setMobileOpen(false)}>
                Podpora
              </a>
              <a href="#atm" onClick={() => setMobileOpen(false)}>
                Pobočky a bankomaty
              </a>
              <Link to="/accounts" onClick={() => setMobileOpen(false)}>
                {cabinetLabel}
              </Link>
            </div>
          </div>

          <div className="mobile-menu__section">
            <div className="mobile-menu__label">Navigace</div>
            <div className="mobile-menu__links">
              <Link to="/cards" onClick={() => setMobileOpen(false)}>
                Karty
              </Link>
              <Link to="/accounts" onClick={() => setMobileOpen(false)}>
                Účty
              </Link>
              <Link to="/loans" onClick={() => setMobileOpen(false)}>
                Úvěry
              </Link>
              <Link to="/payments" onClick={() => setMobileOpen(false)}>
                Platby
              </Link>
            </div>
          </div>

          <div className="mobile-menu__cta">
            {isAuthorized ? (
              <button
                className="site-header__button site-header__button--primary"
                type="button"
                onClick={handleLogout}
              >
                Odhlasit se
              </button>
            ) : (
              <>
                <button
                  className="site-header__button site-header__button--ghost"
                  type="button"
                  onClick={() => (window.location.href = "/login")}
                >
                  Prihlasit se
                </button>
                <button
                  className="site-header__button site-header__button--primary"
                  type="button"
                  onClick={() => (window.location.href = "/register")}
                >
                  Otevrit ucet
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function ChevronDown() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 9.5 12 15l5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 20a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 9.5a5.5 5.5 0 1 1 11 0v3.2c0 .9.3 1.8.9 2.5l.8 1H4.8l.8-1a4.1 4.1 0 0 0 .9-2.5V9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
