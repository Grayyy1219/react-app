import "../css/header.css";
import icon from "../img/icon.png";
import { useEffect, useState } from "react";

type HeaderProps = {
  isAdmin: boolean;
  userEmail: string | null;
  onLogout: () => void;
  onOpenLogin: () => void;
};

function Header({ isAdmin, userEmail, onLogout, onOpenLogin }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => setIsMenuOpen(false);

    window.addEventListener("hashchange", closeMenu);
    return () => window.removeEventListener("hashchange", closeMenu);
  }, []);

  return (
    <header className="site-header">
      <div className="container">
        <div className="header-top-row">
          <div className="view-as">
            <img src={icon} width={24} alt="" />
            <a
              className="logo-btn"
              href="/cse-reviewer/"
              aria-label="Go to homepage"
            >
              <b>Home</b>
            </a>
          </div>

          <button
            className="mobile-menu-btn"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="main-nav-panel"
          >
            {isMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        <div className={`nav ${isMenuOpen ? "menu-open" : ""}`} id="main-nav-panel">
          <nav className="main-nav" aria-label="Main navigation">
            <ul className="nav-list">
              <li>
                <a href="#/home">Home</a>
              </li>
              <li>
                <a href="#/add">Contribute</a>
              </li>
              <li>
                <a href="#/questions">Questions</a>
              </li>
              {userEmail && (
                <>
                  <li>
                    <a href="#/mock-exam">Mock Exam</a>
                  </li>
                  <li>
                    <a href="#/history">History</a>
                  </li>
                </>
              )}
              {isAdmin && (
                <li>
                  <a href="#/config">Config</a>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div className={`nav-actions ${isMenuOpen ? "menu-open" : ""}`}>
          {userEmail ? (
            <>
              <span className="user-pill">{userEmail}</span>
              <button
                className="btn-login"
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <span className="guest-notice">Guest mode · not logged in</span>
              <button
                className="btn-login"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenLogin();
                }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
