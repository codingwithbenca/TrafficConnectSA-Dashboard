
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ShieldCheck } from "lucide-react";
import { auth, db } from "./firebase";
import Login from "./Auth/Login";
import DashboardLayout from "./Dashboard/DashboardLayout";

type StaffProfile = {
  email?: string;
  fullName?: string;
  role?: string;
  status?: string;
};

type AccessState = "checking" | "signedOut" | "authorized";

export default function App() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    let active = true;
    let checkNumber = 0;

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      const currentCheck = ++checkNumber;

console.log("========== ADMIN ACCESS DEBUG ==========");
console.log("Signed-in user:", user ? "YES" : "NO");
console.log("User UID:", user?.uid ?? "No user signed in");
console.log("User email:", user?.email ?? "No email");
console.log("Firebase project ID:", db.app.options.projectId);

if (user) {
  console.log("Expected staff document:", `adminUsers/${user.uid}`);
}

console.log("========================================");

      if (!user) {
        if (active) {
          setStaff(null);
          setAccessState("signedOut");
        }
        return;
      }

      if (active) {
        setAccessState("checking");
        setStaff(null);
      }

      try {
        const profileRef = doc(db, "adminUsers", user.uid);
        const profileSnapshot = await getDoc(profileRef);

        if (!active || currentCheck !== checkNumber) return;

        if (!profileSnapshot.exists()) {
          setAccessError(
            "No authorized staff profile was found. Contact your system administrator."
          );
          await signOut(auth);
          return;
        }

        const profile = profileSnapshot.data() as StaffProfile;
        const allowedRoles = ["admin", "staff"];

        const emailMatches =
          typeof profile.email === "string" &&
          profile.email.trim().toLowerCase() ===
            (user.email ?? "").trim().toLowerCase();

        const authorized =
          emailMatches &&
          profile.status === "active" &&
          typeof profile.role === "string" &&
          allowedRoles.includes(profile.role);

        if (!authorized) {
          setAccessError(
            "Your staff account is inactive or does not have the required permissions."
          );
          await signOut(auth);
          return;
        }

        setStaff(profile);
        setAccessError("");
        setAccessState("authorized");
      } catch (error) {
        console.error("Staff access verification failed:", error);

        if (!active || currentCheck !== checkNumber) return;

        setAccessError(
          "We could not verify your staff access. Check your connection and try again."
        );

        await signOut(auth);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
      setStaff(null);
      setAccessError("");
      setAccessState("signedOut");
    } catch (error) {
      console.error("Logout failed:", error);
      setAccessError("Unable to sign out. Please try again.");
    }
  }

  if (accessState === "checking") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#F3F5F7",
          color: "#0B4F8A",
          fontFamily: "Segoe UI, Arial, sans-serif",
        }}
      >
        <ShieldCheck size={38} />
        <h2 style={{ margin: 0 }}>Verifying staff access</h2>
        <p style={{ color: "#718096" }}>
          Please wait while we verify your authorization.
        </p>
      </main>
    );
  }

  if (accessState === "signedOut") {
    return (
      <Login
        accessError={accessError}
        onClearAccessError={() => setAccessError("")}
      />
    );
  }

  return <DashboardLayout staff={staff} onLogout={handleLogout} />;
}
