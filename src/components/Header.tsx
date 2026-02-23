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
          <a className="logo-btn" href="/" aria-label="Go to homepage">
            <b>Home</b>
          </a>
        </div>

        <div className="nav">
          <nav className="main-nav" aria-label="Main navigation">
            <ul className="nav-list">
              <li>
                <a href="#/add">Add</a>
              </li>
              <li>
                <a href="#branding">Branding</a>
              </li>
              <li>
                <a href="#capsule">Capsule</a>
              </li>
              {isAdmin && (
                <li>
                  <a href="#admin">Admin</a>
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
            <button className="btn-login" onClick={onOpenLogin}>
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
