import { useState } from "react";
import { getUserCredentials, saveUserCredentials, type UserRole } from "../firebase";
import "../css/auth.css";

type AuthPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (role: UserRole, email: string) => void;
};

function AuthPanel({ isOpen, onClose, onLogin }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<UserRole>("regular");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) {
    return null;
  }

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRole("regular");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Email and password are required.");
      return;
    }

    setIsSaving(true);

    try {
      if (mode === "register") {
        await saveUserCredentials({
          email: email.trim(),
          password,
          role,
        });
        alert("Account created. You can login now.");
        setMode("login");
        resetForm();
        return;
      }

      const user = await getUserCredentials(email);

      if (!user || user.password !== password) {
        alert("Invalid email or password.");
        return;
      }

      onLogin(user.role, user.email);
      resetForm();
      onClose();
    } catch (error) {
      console.error("Auth error", error);
      alert("Something went wrong while talking to Firebase.");
    } finally {
      setIsSaving(false);
    }
  };

  const isLoginMode = mode === "login";

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <section className="auth-panel" onClick={(event) => event.stopPropagation()}>
        <div className="auth-header-row">
          <div>
            <p className="auth-subtitle">Welcome</p>
            <h2>{isLoginMode ? "Sign in to your account" : "Create your account"}</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close login modal">
            ✕
          </button>
        </div>

        {isLoginMode && (
          <p className="auth-notice">
            You are currently browsing as a guest. Please log in to save your progress and access your
            personalized workspace.
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field-label" htmlFor="auth-email">
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />

          <label className="auth-field-label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {!isLoginMode && (
            <label className="role-picker" htmlFor="auth-role">
              Role
              <select
                id="auth-role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="regular">Regular user</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}

          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : isLoginMode ? "Sign in" : "Create account"}
          </button>
        </form>

        <button className="toggle-auth-mode" onClick={() => setMode(isLoginMode ? "register" : "login")}>
          {isLoginMode ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </div>
  );
}

export default AuthPanel;
