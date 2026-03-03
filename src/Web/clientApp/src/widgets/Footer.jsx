import { LuFacebook, LuInstagram, LuGithub, LuTwitter } from "react-icons/lu";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <h1 className="footer-logo">ZXC Bank</h1>
        <p>Spolehlivý partner pro správu vašich financí a plateb.</p>
      </div>

      <div className="footer-links">
        <div>
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
        <div>
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
        <div>
          <p className="footer-links-title">Právní informace</p>
          <ul className="footer-list">
            <li>
              <a href="/">Ochrana osobních údajů</a>
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
          &copy; 2026 ZXC Bank. Všechna práva vyhrazena. ZXC Bank je registrovaná
          finanční instituce. Služby podléhají obchodním podmínkám.
        </p>
        <div className="footer-socials">
          <a href="https://www.facebook.com/">
            <LuFacebook size={24} />
          </a>
          <a href="https://www.instagram.com/">
            <LuInstagram size={24} />
          </a>
          <a href="https://twitter.com/">
            <LuTwitter size={24} />
          </a>
          <a href="https://github.com/">
            <LuGithub size={24} />
          </a>
        </div>
      </div>
    </footer>
  );
}
