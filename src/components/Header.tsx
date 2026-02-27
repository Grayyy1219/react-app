import "../css/header.css";
import icon from "../img/icon.png";

type HeaderProps = {
  isAdmin: boolean;
  userEmail: string | null;
  onLogout: () => void;
  onOpenLogin: () => void;
};

function Header({ isAdmin, userEmail, onLogout, onOpenLogin }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container">
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

        <div className="nav">
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

        <div className="nav-actions">
          {userEmail ? (
            <>
              <span className="user-pill">{userEmail}</span>
              <button className="btn-login" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <span className="guest-notice">Guest mode · not logged in</span>
              <button className="btn-login" onClick={onOpenLogin}>
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
