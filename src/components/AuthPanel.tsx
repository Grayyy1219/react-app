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

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <section className="auth-panel" onClick={(event) => event.stopPropagation()}>
        <div className="auth-header-row">
          <h2>{mode === "login" ? "Login" : "Create account"}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close login modal">
            ✕
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
          />

          {mode === "register" && (
            <label className="role-picker">
              Role
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                <option value="regular">Regular user</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}

          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : mode === "login" ? "Login" : "Register"}
          </button>
        </form>

        <button
          className="toggle-auth-mode"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </section>
    </div>
  );
}

export default AuthPanel;
