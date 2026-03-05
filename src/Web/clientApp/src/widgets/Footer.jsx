import "./Footer.css";
import { LuFacebook, LuInstagram, LuGithub, LuTwitter } from "react-icons/lu";
import "./Footer.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-top">
          <h2 className="footer-logo">ZXC Bank</h2>
          <p className="footer-tagline">
            Váš spolehlivý partner pro správu financí a plateb.
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <p className="footer-links-title">Produkty</p>
            <ul className="footer-list">
              <li>
                <a href="/">Běžné účty</a>
              </li>
              <li>
                <a href="/">Spořicí účty</a>
              </li>
              <li>
                <a href="/">Kreditní karty</a>
              </li>
              <li>
                <a href="/">Úvěry</a>
              </li>
            </ul>
          </div>

          <div className="footer-column">
            <p className="footer-links-title">Společnost</p>
            <ul className="footer-list">
              <li>
                <a href="/">O nás</a>
              </li>
              <li>
                <a href="/">Kontakt</a>
              </li>
              <li>
                <a href="/">Kariéra</a>
              </li>
              <li>
                <a href="/">Centrum nápovědy</a>
              </li>
            </ul>
          </div>

          <div className="footer-column">
            <p className="footer-links-title">Právní informace</p>
            <ul className="footer-list">
              <li>
                <a href="/">Zásady ochrany osobních údajů</a>
              </li>
              <li>
                <a href="/">Obchodní podmínky</a>
              </li>
              <li>
                <a href="/">Bezpečnost</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-copyright">
          <p>
            &copy; {year} ZXC Bank. Všechna práva vyhrazena. ZXC Bank je
            registrovaná finanční instituce působící v souladu s platnými
            právními předpisy.
          </p>

          <div className="footer-socials">
            <a
              href="https://www.facebook.com/"
              target="_blank"
              rel="noreferrer"
            >
              <LuFacebook size={20} />
            </a>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
            >
              <LuInstagram size={20} />
            </a>
            <a href="https://twitter.com/" target="_blank" rel="noreferrer">
              <LuTwitter size={20} />
            </a>
            <a href="https://github.com/" target="_blank" rel="noreferrer">
              <LuGithub size={20} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
