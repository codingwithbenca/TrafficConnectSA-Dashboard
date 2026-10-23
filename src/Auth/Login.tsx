
import React, { useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { auth } from "../firebase";
import DevelopmentSignUp from "./DevelopmentSignUp";
import "./Login.css";

type LoginProps = {
  accessError?: string;
  onClearAccessError?: () => void;
};

export default function Login({
  accessError = "",
  onClearAccessError,
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showDevelopmentSignUp, setShowDevelopmentSignUp] =
    useState(false);

  // The temporary registration button is available only in development.
  const isDevelopment = import.meta.env.DEV;

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");
    onClearAccessError?.();
    setLoading(true);

    try {
      await setPersistence(
        auth,
        rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // App.tsx verifies the user's Firestore staff record.
      // Do not bypass the authorization check here.
    } catch (error: unknown) {
      console.error("Sign-in failed:", error);

      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(error.code)
          : "";

      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-email"
      ) {
        setError("The email address or password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        setError(
          "Too many unsuccessful attempts. Please wait and try again later."
        );
      } else if (code === "auth/network-request-failed") {
        setError(
          "Network error. Check your internet connection."
        );
      } else if (code === "auth/operation-not-allowed") {
        setError(
          "Email and password sign-in is not enabled in Firebase Authentication."
        );
      } else {
        setError(
          "We could not sign you in. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Enter your work email address first.");
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);

      setMessage(
        "If this account is eligible for password recovery, a reset email will be sent."
      );
    } catch (error: unknown) {
      console.error("Password recovery failed:", error);

      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error
          ? String(error.code)
          : "";

      if (code === "auth/invalid-email") {
        setError("Enter a valid email address.");
      } else if (code === "auth/too-many-requests") {
        setError(
          "Too many requests. Please wait before trying again."
        );
      } else {
        // Avoid exposing whether a staff account exists.
        setMessage(
          "If this account is eligible for password recovery, a reset email will be sent."
        );
      }
    } finally {
      setResetLoading(false);
    }
  }

  const visibleError = error || accessError;

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand-content">
          <div className="brand-logo">
            <ShieldCheck size={34} strokeWidth={1.8} />
          </div>

          <p className="brand-eyebrow">
            TRAFFIC SERVICES ADMINISTRATION
          </p>

          <h1>
            TrafficConnect
            <span>SA</span>
          </h1>

          <p className="brand-description">
            A connected platform for managing traffic services,
            vehicle applications and road incident information.
          </p>

          <div className="brand-divider" />

          <div className="security-note">
            <LockKeyhole size={20} />

            <div>
              <strong>Secure staff access</strong>
              <p>For authorized personnel only.</p>
            </div>
          </div>
        </div>

        <div className="brand-footer">
          <span>TRAFFICCONNECT SA</span>
          <span>ADMINISTRATION PORTAL</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="mobile-brand">
            <ShieldCheck size={28} />
            <span>TrafficConnect SA</span>
          </div>

          <div className="login-heading">
            <span className="login-label">STAFF PORTAL</span>

            <h2>Welcome back</h2>

            <p>
              Sign in to access your administration workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">
                Work email address
              </label>

              <input
                id="email"
                type="email"
                placeholder="name@department.gov.za"
                autoComplete="username"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setMessage("");
                }}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <div className="password-label-row">
                <label htmlFor="password">Password</label>

                <button
                  type="button"
                  className="text-button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading || loading}
                >
                  {resetLoading
                    ? "Sending..."
                    : "Forgot password?"}
                </button>
              </div>

              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  required
                  disabled={loading}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                disabled={loading}
              />

              <span>Remember me on this device</span>
            </label>

            {visibleError && (
              <div
                className="login-feedback login-feedback-error"
                role="alert"
              >
                {visibleError}
              </div>
            )}

            {message && (
              <div
                className="login-feedback login-feedback-success"
                role="status"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in to your account"}

              {!loading && (
                <span aria-hidden="true">→</span>
              )}
            </button>

            {isDevelopment && (
              <button
                type="button"
                className="development-signup-trigger"
                onClick={() => {
                  setError("");
                  setMessage("");
                  setShowDevelopmentSignUp(true);
                }}
                disabled={loading || resetLoading}
              >
                <UserPlus size={17} />
                Create temporary development account
              </button>
            )}
          </form>

          <div className="login-security">
            <LockKeyhole size={15} />
            <span>Authorized personnel only</span>
          </div>

          <p className="login-disclaimer">
            This portal is intended for approved staff members.
            Unauthorized access is not permitted.
          </p>
        </div>

        <footer className="page-footer">
          <span>TrafficConnect SA</span>
          <span>Administration Portal · Prototype</span>
        </footer>
      </section>

      {isDevelopment && showDevelopmentSignUp && (
        <DevelopmentSignUp
          onClose={() => setShowDevelopmentSignUp(false)}
        />
      )}
    </main>
  );
}
