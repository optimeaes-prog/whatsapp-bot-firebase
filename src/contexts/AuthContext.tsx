import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { analytics } from "../lib/analytics";
import { setOrganizationId } from "../lib/organization";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  organizationId: string;
  role: string;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationIdState] = useState<string>("");
  const [role, setRole] = useState<string>("");

  const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

  const updateOrgId = (id: string) => {
    setOrganizationId(id); // Update the global non-reactive variable for legacy services
    setOrganizationIdState(id); // Update the reactive state for components
  };

  async function resolveUserOrganization(user: User, nameHint?: string) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    console.log(`[Auth-Diagnostic] userSnap exists: ${userSnap.exists()}, data:`, userSnap.exists() ? userSnap.data() : "NO DOCUMENT");

    // Paco Granados Exception - prioritize this
    const pacoEmails = ["paco.granados@atlascapitalgroup.com", "ejperezreyes@gmail.com"];
    if (user.email && pacoEmails.some(email => user.email?.toLowerCase().includes(email.split('@')[0].toLowerCase()))) {
      const orgId = "org_paco_granados";
      const finalRole = "owner";
      
      const existingData = userSnap.exists() ? userSnap.data() : null;
      if (!existingData || existingData.orgId !== orgId || existingData.role !== finalRole) {
        await setDoc(userRef, {
          email: user.email,
          name: nameHint || user.displayName || "Owner",
          role: finalRole,
          orgId: orgId,
          createdAt: existingData?.createdAt || new Date().toISOString()
        }, { merge: true });
      }
      
      updateOrgId(orgId);
      setRole(finalRole);
      console.log(`[Auth-Diagnostic] User resolved via Exception. orgId: "${orgId}" role: "${finalRole}"`);
      return;
    }

    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.orgId) {
        updateOrgId(data.orgId);
        if (data.role) setRole(data.role);
        console.log(`[Auth-Diagnostic] User resolved via Firestore. orgId: "${data.orgId}" role: "${data.role}"`);
        return;
      }
    }

    // Invitation logic
    const urlParams = new URLSearchParams(window.location.search);
    const invitationToken = urlParams.get("token");

    if (invitationToken) {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch(`${FUNCTIONS_BASE_URL}/acceptInvitation`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token: invitationToken }),
        });

        if (response.ok) {
          const data = await response.json();
          updateOrgId(data.orgId);
          // Fetch the new user doc to get the assigned role
          const updatedUserSnap = await getDoc(userRef);
          if (updatedUserSnap.exists()) {
            setRole(updatedUserSnap.data().role || "member");
          }
          // Remove token from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      } catch (err) {
        console.error("Failed to accept invitation:", err);
      }
    }

    // Default: Create new organization
    const orgRef = doc(collection(db, "organizations"));
    const orgId = orgRef.id;
    
    await setDoc(orgRef, {
      onboardingCompleted: false,
      onboardingStep: 0,
      createdAt: new Date().toISOString(),
      plan: "free"
    });

    const finalRole = "owner";
    await setDoc(userRef, {
      email: user.email,
      name: nameHint || user.displayName || "Nuevo Usuario",
      role: finalRole,
      orgId: orgId,
      createdAt: new Date().toISOString()
    });

    updateOrgId(orgId);
    setRole(finalRole);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await resolveUserOrganization(currentUser);
        } catch (error) {
          console.error("Failed to resolve organization:", error);
        }
      } else {
        updateOrgId(""); // Reset to empty when logged out
      }
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    analytics.trackLogin("email");
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await resolveUserOrganization(result.user);
    analytics.trackLogin("google");
  };

  const signUp = async (email: string, password: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    await resolveUserOrganization(result.user, name);
    analytics.trackSignUp("email");
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    analytics.trackLogout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        organizationId,
        role,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
