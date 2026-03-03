import { useEffect, useState } from "react";
import "./header_style.css";

const CATEGORIES = [
    { id: "private", label: "Soukromým osobám", href: "#private" },
    { id: "business", label: "Pro podnikatele", href: "#business" },
    { id: "premium", label: "Premium", href: "#premium" },
];

const MORE_MENU = [
    { label: "Podpora", href: "#support" },
    { label: "Pobočky a bankomaty", href: "#atm" },
    { label: "Kontakty", href: "#contacts" },
];

const NAV = [
    { label: "Investice", href: "#invest" },
    { label: "Platby", href: "#payments" },
];

const LOGO_URL = "https://i.ytimg.com/vi/TiE9pWAwYOs/maxresdefault.jpg";

export default function Header() {
    const [activeCategory, setActiveCategory] = useState("private");
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = mobileOpen ? "hidden" : "";
        return () => (document.body.style.overflow = "");
    }, [mobileOpen]);

    return (
        <header className="site-header">
            <div className="site-header__container">
                {/* TOP (как на tbank): категории + личный кабинет */}
                <div className="site-header__top">
                    <nav className="site-header__categories" aria-label="Kategorie">
                        <ul className="site-header__categoriesList">
                            {CATEGORIES.map((c) => (
                                <li key={c.id} className="site-header__categoriesItem">
                                    <a
                                        className={`site-header__categoryLink ${
                                            activeCategory === c.id ? "is-active" : ""
                                        }`}
                                        href={c.href}
                                        onClick={() => setActiveCategory(c.id)}
                                    >
                                        {c.label}
                                    </a>
                                </li>
                            ))}

                            <li className="site-header__categoriesItem">
                                <details className="site-header__more">
                                    <summary className="site-header__categoryLink site-header__moreSummary">
                                        Více <ChevronDown />
                                    </summary>

                                    <div className="site-header__moreDropdown">
                                        {MORE_MENU.map((item) => (
                                            <a
                                                key={item.href}
                                                className="site-header__moreLink"
                                                href={item.href}
                                            >
                                                {item.label}
                                            </a>
                                        ))}
                                    </div>
                                </details>
                            </li>
                        </ul>
                    </nav>

                    <a className="site-header__cabinet" href="#cabinet" aria-label="Osobní účet">
                        Osobní účet <UserIcon />
                    </a>
                </div>

                {/* MAIN: лого + меню + кнопки */}
                <div className="site-header__main">
                    <a className="site-header__logo" href="/" aria-label="Domů">
            <span className="site-header__logoMark" aria-hidden="true">
              <img className="site-header__logoImg" src={LOGO_URL} alt="" />
            </span>

                        <span className="site-header__logoText">
              <span className="site-header__logoStrong">ZXC</span>{" "}
                            <span className="site-header__logoSoft">bank</span>
            </span>
                    </a>

                    <nav className="site-header__nav" aria-label="Hlavní menu">
                        <ul className="site-header__navList">
                            <li className="site-header__navItem">
                                <details className="site-header__details">
                                    <summary className="site-header__navLink site-header__summary">
                                        Produkty <ChevronDown />
                                    </summary>
                                    <div className="site-header__dropdown">
                                        <a className="site-header__dropdownLink" href="#cards">
                                            Karty
                                        </a>
                                        <a className="site-header__dropdownLink" href="#accounts">
                                            Účty
                                        </a>
                                        <a className="site-header__dropdownLink" href="#loans">
                                            Půjčky
                                        </a>
                                        <a className="site-header__dropdownLink" href="#insurance">
                                            Pojištění
                                        </a>
                                    </div>
                                </details>
                            </li>

                            {NAV.map((item) => (
                                <li key={item.href} className="site-header__navItem">
                                    <a className="site-header__navLink" href={item.href}>
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="site-header__actions">
                        <button
                            className="site-header__iconButton"
                            type="button"
                            aria-label="Hledat"
                        >
                            <SearchIcon />
                        </button>

                        <button
                            className="site-header__button site-header__button--ghost"
                            type="button"
                        >
                            Přihlásit se
                        </button>

                        <button
                            className="site-header__button site-header__button--primary"
                            type="button"
                        >
                            Založit účet
                        </button>

                        <button
                            className="site-header__burger"
                            type="button"
                            aria-label={mobileOpen ? "Zavřít menu" : "Otevřít menu"}
                            aria-expanded={mobileOpen}
                            onClick={() => setMobileOpen((v) => !v)}
                        >
                            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
                        </button>
                    </div>
                </div>
            </div>

            {/* MOBILE */}
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
                                Soukromým osobám
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
                            <a href="#cabinet" onClick={() => setMobileOpen(false)}>
                                Osobní účet
                            </a>
                        </div>
                    </div>

                    <div className="mobile-menu__section">
                        <div className="mobile-menu__label">Navigace</div>
                        <div className="mobile-menu__links">
                            <a href="#cards" onClick={() => setMobileOpen(false)}>Karty</a>
                            <a href="#accounts" onClick={() => setMobileOpen(false)}>Účty</a>
                            <a href="#loans" onClick={() => setMobileOpen(false)}>Půjčky</a>
                            <a href="#invest" onClick={() => setMobileOpen(false)}>Investice</a>
                            <a href="#payments" onClick={() => setMobileOpen(false)}>Platby</a>
                        </div>
                    </div>

                    <div className="mobile-menu__cta">
                        <button className="site-header__button site-header__button--ghost" type="button">
                            Přihlásit se
                        </button>
                        <button className="site-header__button site-header__button--primary" type="button">
                            Založit účet
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}

/* ===== icons ===== */

function SearchIcon() {
    return (
        <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path
                d="M16.5 16.5 21 21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
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