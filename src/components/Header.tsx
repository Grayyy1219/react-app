import "../css/header.css";
import icon from "../img/icon.png";
function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <div className="view-as">
          <img src={icon} width={24} alt="" />
          <a href="" className="logo" aria-label="Go to homepage">
            <b>Home</b>
          </a>
        </div>

        <div className="nav">
          <nav className="main-nav" aria-label="Main navigation">
            <ul className="nav-list">
              <li>
                <a href="/add">Add</a>
              </li>
              <li>
                <a href="#branding">Branding</a>
              </li>
              <li>
                <a href="#capsule">Capsule</a>
              </li>
              <li>
                <a href="#user">User</a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="nav-actions hidden">
          <a href="login.html" className="btn-login">
            Login
          </a>
          <a href="signup" className="btn-primary">
            Sign Up
          </a>
        </div>

        <div className="burger">
          <button
            className="menu-toggle"
            aria-label="Open menu"
            aria-expanded="false"
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
