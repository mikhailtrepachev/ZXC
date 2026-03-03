import "./Footer.css";
import { LuFacebook, LuInstagram, LuGithub, LuTwitter } from "react-icons/lu";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <h1 className="footer-logo">ZXC Bank</h1>
        <p>Your trusted partner in managing money and payments.</p>
      </div>

      <div className="footer-links">
        <div>
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
        <div>
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
        <div>
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
          &copy; 2026 ZXC Bank. All rights reserved. ZXC Bank is a registered
          financial institution.
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
