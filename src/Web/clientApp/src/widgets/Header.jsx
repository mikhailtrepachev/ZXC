import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./header_style.css";

const CATEGORIES = [
  { id: "private", label: "Pro občany" },
  { id: "business", label: "Pro podnikatele" },
  { id: "premium", label: "Premium" },
];

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
        {/* TOP BAR */}
        <div className="site-header__top">
          <nav className="site-header__categories">
            <ul className="site-header__categoriesList">
              {CATEGORIES.map((category) => (
                <li key={category.id}>
                  <button
                    className={`site-header__categoryLink ${
                      activeCategory === category.id ? "is-active" : ""
                    }`}
                    onClick={() => setActiveCategory(category.id)}
                  >
                    {category.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <Link className="site-header__cabinet" to="/accounts">
            Internetové bankovnictví
          </Link>
        </div>

        {/* MAIN BAR */}
        <div className="site-header__main">
          <Link className="site-header__logo" to="/accounts">
            <span className="site-header__logoStrong">ZXC</span>{" "}
            <span className="site-header__logoSoft">bank</span>
          </Link>

          <nav className="site-header__nav">
            <ul className="site-header__navList">
              <li>
                <details className="site-header__details">
                  <summary className="site-header__navLink">
                    Produkty
                  </summary>

                  <div className="site-header__dropdown">
                    <Link to="/cards" className="site-header__dropdownLink">
                      Karty
                    </Link>

                    <Link to="/accounts" className="site-header__dropdownLink">
                      Účty
                    </Link>

                    <Link to="/loans" className="site-header__dropdownLink">
                      Úvěry
                    </Link>

                    <Link to="/insurance" className="site-header__dropdownLink">
                      Pojištění
                    </Link>
                  </div>
                </details>
              </li>

              <li>
                <Link to="/accounts" className="site-header__navLink">
                  Účty
                </Link>
              </li>

              <li>
                <Link to="/investments" className="site-header__navLink">
                  Investice
                </Link>
              </li>

              <li>
                <Link to="/payments" className="site-header__navLink">
                  Platby
                </Link>
              </li>
            </ul>
          </nav>

          <div className="site-header__actions">
            <Link to="/login" className="site-header__button site-header__button--ghost">
              Přihlásit se
            </Link>

            <Link to="/register" className="site-header__button site-header__button--primary">
              Otevřít účet
            </Link>

            <button
              className="site-header__burger"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div className="mobile-menu">
          <Link to="/cards" onClick={() => setMobileOpen(false)}>Karty</Link>
          <Link to="/accounts" onClick={() => setMobileOpen(false)}>Účty</Link>
          <Link to="/loans" onClick={() => setMobileOpen(false)}>Úvěry</Link>
          <Link to="/investments" onClick={() => setMobileOpen(false)}>Investice</Link>
          <Link to="/payments" onClick={() => setMobileOpen(false)}>Platby</Link>
        </div>
      )}
    </header>
  );
}