import { useEffect, useMemo, useState } from "react";
import Questioner from "./components/Questioner";
import Header from "./components/Header";
import AddQuestion from "./components/AddQuestion";
import AuthPanel from "./components/AuthPanel";
import QuestionsDashboard from "./components/QuestionsDashboard";
import type { UserRole } from "./firebase";

type PageName = "home" | "add" | "questions";

type UserSession = {
  role: UserRole;
  email: string;
};

const SESSION_KEY = "cse-reviewer-user-session";

const getStoredSession = (): UserSession | null => {
  const rawSession = sessionStorage.getItem(SESSION_KEY);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as UserSession;
  } catch (error) {
    console.error("Invalid stored session", error);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
};

const pageFromHash = (hashValue: string): PageName => {
  if (hashValue === "#/add") {
    return "add";
  }

  if (hashValue === "#/questions") {
    return "questions";
  }

  return "home";
};

function App() {
  const [userRole, setUserRole] = useState<UserRole | null>(
    () => getStoredSession()?.role ?? null,
  );
  const [userEmail, setUserEmail] = useState<string | null>(
    () => getStoredSession()?.email ?? null,
  );
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageName>(
    pageFromHash(window.location.hash),
  );

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

    if (currentPage === "questions") {
      return <QuestionsDashboard isAdmin={userRole === "admin"} />;
    }

    return <Questioner isAdmin={userRole === "admin"} />;
  }, [currentPage, userRole]);

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
