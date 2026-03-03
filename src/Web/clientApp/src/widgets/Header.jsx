import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAccessToken, logoutUser } from "../auth/session";
import "./header_style.css";

const NAV = [
  { label: "Účty", href: "/accounts" },
  { label: "Karty", href: "/cards" },
  { label: "Úvěry", href: "/loans" },
  { label: "Platby", href: "/payments" },
];

const LOGO_URL = "https://i.ytimg.com/vi/TiE9pWAwYOs/maxresdefault.jpg";

function resolveUserLabel(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const raw =
    payload.email ||
    payload.userName ||
    payload.username ||
    payload.name ||
    payload.fullName ||
    "";

  if (typeof raw !== "string") {
    return "";
  }

  return raw.trim();
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

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
      const headers = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        const response = await fetch("/api/Users/manage/info", {
          method: "GET",
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          if (isMounted) {
            setCurrentUser("");
            setIsAuthorized(false);
          }
          return;
        }

        const payload = await response.json().catch(() => null);
        const userLabel = resolveUserLabel(payload);

        if (isMounted) {
          setCurrentUser(userLabel);
          setIsAuthorized(true);
        }
      } catch {
        if (isMounted) {
          setCurrentUser("");
          setIsAuthorized(false);
        }
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
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);
  const cabinetLabel = currentUser ? currentUser : "Internetové bankovnictví";

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser("");
    setIsAuthorized(false);
    setMobileOpen(false);
    setUserMenuOpen(false);
    window.location.href = "/login";
  };

  const handleUserSettings = () => {
    setUserMenuOpen(false);
    window.location.href = "/accounts";
  };

  return (
    <header className="site-header">
      <div className="site-header__container">
        <div className="site-header__main">
          <Link className="site-header__logo" to="/accounts" aria-label="Domů">
            <span className="site-header__logoMark" aria-hidden="true">
              <img className="site-header__logoImg" src={LOGO_URL} alt="" />
            </span>

            <span className="site-header__logoText">
              <span className="site-header__logoStrong">ZXC</span>{" "}
              <span className="site-header__logoSoft">bank</span>
            </span>
          </Link>

          <nav className="site-header__nav" aria-label="Hlavní menu">
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
              <div className="site-header__userMenu" ref={userMenuRef}>
                <button
                  className="site-header__cabinet site-header__cabinetButton"
                  type="button"
                  onClick={() => setUserMenuOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className="site-header__cabinetText">{cabinetLabel}</span>
                  <UserIcon />
                </button>

                {userMenuOpen && (
                  <div className="site-header__userDropdown" role="menu">
                    <button className="site-header__userDropdownButton" type="button" onClick={handleUserSettings}>
                      Nastavení uživatele
                    </button>
                    <button className="site-header__userDropdownButton" type="button" onClick={handleLogout}>
                      Odhlásit se
                    </button>
                  </div>
                )}
              </div>
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
              aria-label={mobileOpen ? "Zavřít menu" : "Otevřít menu"}
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
              aria-label="Zavřít"
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
                Odhlásit se
              </button>
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

function MenuIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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


