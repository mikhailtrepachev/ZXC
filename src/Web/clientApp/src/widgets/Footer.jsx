import "./Footer.css";
import { LuFacebook, LuInstagram, LuGithub, LuTwitter } from "react-icons/lu";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-top">
          <h2 className="footer-logo">ZXC Bank</h2>
          <p className="footer-tagline">
            Your trusted partner in managing money and payments.
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-column">
            <p className="footer-links-title">Products</p>
            <ul className="footer-list">
              <li>
                <a href="/">Checking Accounts</a>
              </li>
              <li>
                <a href="/">Savings Accounts</a>
              </li>
              <li>
                <a href="/">Credit Cards</a>
              </li>
              <li>
                <a href="/">Loans</a>
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <p className="footer-links-title">Company</p>
            <ul className="footer-list">
              <li>
                <a href="/">About Us</a>
              </li>
              <li>
                <a href="/">Contact</a>
              </li>
              <li>
                <a href="/">Careers</a>
              </li>
              <li>
                <a href="/">Help Center</a>
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <p className="footer-links-title">Legal</p>
            <ul className="footer-list">
              <li>
                <a href="/">Privacy Policy</a>
              </li>
              <li>
                <a href="/">Terms of Service</a>
              </li>
              <li>
                <a href="/">Security</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-copyright">
          <p>
            &copy; {year} ZXC Bank. All rights reserved. ZXC Bank is a
            registered financial institution.
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
