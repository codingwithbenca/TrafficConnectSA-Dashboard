
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { X, UserPlus, LoaderCircle } from "lucide-react";
import { auth, db } from "../firebase";
import "./DevelopmentSignUp.css";

type DevelopmentSignUpProps = {
  onClose: () => void;
};

export default function DevelopmentSignUp({
  onClose,
}: DevelopmentSignUpProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignUp(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();

    if (!normalizedName) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    let createdUser: typeof auth.currentUser = null;

    try {
      // Create the account in Firebase Authentication.
      const credential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      createdUser = credential.user;

      await updateProfile(credential.user, {
        displayName: normalizedName,
      });

      const profileRef = doc(
        db,
        "adminUsers",
        credential.user.uid
      );

      // This temporary registration flow only creates a staff profile.
      // It must never grant the admin role automatically.
      await runTransaction(db, async (transaction) => {
        const existingProfile = await transaction.get(profileRef);

        if (existingProfile.exists()) {
          throw new Error("STAFF_PROFILE_ALREADY_EXISTS");
        }

        transaction.set(profileRef, {
          uid: credential.user.uid,
          fullName: normalizedName,
          email: normalizedEmail,
          role: "staff",
          status: "active",
          accountType: "temporary-development",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setSuccess(true);

      // The existing App.tsx auth listener will verify the profile.
      // Close this panel so the login/dashboard flow can continue.
      onClose();
    } catch (err: unknown) {
      console.error("Development registration failed:", err);

      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";

      if (err instanceof Error &&
          err.message === "STAFF_PROFILE_ALREADY_EXISTS") {
        setError(
          "A staff profile already exists for this account."
        );
      } else if (code === "auth/email-already-in-use") {
        setError(
          "This email already has a Firebase Authentication account. Return to sign in."
        );
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else if (
        code === "permission-denied" ||
        code === "firestore/permission-denied"
      ) {
        setError(
          "Firebase rejected the staff profile write. Check your Firestore rules."
        );
      } else {
        setError(
          "Account creation could not be completed. Check the browser console and Firebase configuration."
        );
      }

      // If Authentication succeeded but saving the staff profile failed,
      // sign out rather than leave an unverified session active.
      if (createdUser) {
        try {
          const { signOut } = await import("firebase/auth");
          await signOut(auth);
        } catch (signOutError) {
          console.error(
            "Could not sign out after registration failure:",
            signOutError
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dev-signup-overlay">
      <section
        className="dev-signup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-signup-title"
      >
        <button
          type="button"
          className="dev-signup-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Close registration"
        >
          <X size={21} />
        </button>

        <div className="dev-signup-icon">
          <UserPlus size={27} />
        </div>

        <span className="dev-signup-eyebrow">
          TEMPORARY DEVELOPMENT TOOL
        </span>

        <h2 id="dev-signup-title">Create a staff account</h2>

        <p className="dev-signup-description">
          Create a test account for your TrafficConnect SA
          administration portal.
        </p>

        <div className="dev-signup-notice">
          <strong>Development mode</strong>
          <span>
            New accounts receive the staff role, not administrator
            privileges.
          </span>
        </div>

        <form onSubmit={handleSignUp}>
          <div className="dev-signup-field">
            <label htmlFor="dev-full-name">Full name</label>
            <input
              id="dev-full-name"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              disabled={loading}
              maxLength={100}
            />
          </div>

          <div className="dev-signup-field">
            <label htmlFor="dev-email">Email address</label>
            <input
              id="dev-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
              maxLength={254}
            />
          </div>

          <div className="dev-signup-field">
            <label htmlFor="dev-password">Password</label>
            <input
              id="dev-password"
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
              minLength={8}
            />
          </div>

          <div className="dev-signup-field">
            <label htmlFor="dev-confirm-password">
              Confirm password
            </label>
            <input
              id="dev-confirm-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password again"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              required
              disabled={loading}
              minLength={8}
            />
          </div>

          <label className="dev-signup-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) =>
                setShowPassword(event.target.checked)
              }
              disabled={loading}
            />
            Show passwords
          </label>

          {error && (
            <div className="dev-signup-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="dev-signup-success" role="status">
              Account created successfully.
            </div>
          )}

          <button
            type="submit"
            className="dev-signup-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="dev-signup-spinner" size={18} />
                Creating account...
              </>
            ) : (
              "Create development account"
            )}
          </button>
        </form>

        <p className="dev-signup-footer">
          Accounts are stored in Firebase Authentication and
          Cloud Firestore.
        </p>
      </section>
    </div>
  );
}
