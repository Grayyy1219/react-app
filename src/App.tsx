import { useEffect, useMemo, useState } from "react";
import Questioner from "./components/Questioner";
import Header from "./components/Header";
import AddQuestion from "./components/AddQuestion";
import AuthPanel from "./components/AuthPanel";
import type { UserRole } from "./firebase";

type PageName = "home" | "add";

type UserSession = {
  role: UserRole;
  email: string;
};

const SESSION_KEY = "react-app-user-session";

const pageFromHash = (hashValue: string): PageName => {
  if (hashValue === "#/add") {
    return "add";
  }
  return "home";
};

function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageName>(
    pageFromHash(window.location.hash),
  );

  useEffect(() => {
    const rawSession = sessionStorage.getItem(SESSION_KEY);

    if (!rawSession) {
      return;
    }

    try {
      const session = JSON.parse(rawSession) as UserSession;
      setUserRole(session.role);
      setUserEmail(session.email);
    } catch (error) {
      console.error("Invalid stored session", error);
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(pageFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleLogin = (role: UserRole, email: string) => {
    setUserRole(role);
    setUserEmail(email);
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        role,
        email,
      } satisfies UserSession),
    );
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserEmail(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const pageContent = useMemo(() => {
    if (currentPage === "add") {
      return <AddQuestion />;
    }
    return <Questioner />;
  }, [currentPage]);

  return (
    <>
      <Header
        isAdmin={userRole === "admin"}
        userEmail={userEmail}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      <AuthPanel
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={handleLogin}
      />
      {pageContent}
      {/* <main className="app-main-content"></main> */}
    </>
  );
}

export default App;
