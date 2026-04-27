import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { analytics } from "../lib/analytics";
import { setOrganizationId } from "../lib/organization";
import { getAllOrganizations, getAllOrganizationsForSuperAdmin } from "../services/organization";

type AppRole = "owner" | "admin" | "member" | "super_admin" | "";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  organizationId: string;
  role: AppRole | string;
  availableOrganizations: { id: string; agencyName?: string }[];
  switchOrganization: (orgId: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();
const SUPER_ADMIN_ACTIVE_ORG_KEY = "proplead.activeOrgId";
const FORCED_SUPER_ADMIN_EMAILS = new Set(["ejperezreyes@gmail.com"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationIdState] = useState<string>("");
  const [role, setRole] = useState<AppRole | string>("");
  const [availableOrganizations, setAvailableOrganizations] = useState<{ id: string; agencyName?: string }[]>([]);
  const resolveInFlightRef = useRef<Promise<void> | null>(null);

  const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

  const updateOrgId = (id: string) => {
    setOrganizationId(id); // Update the global non-reactive variable for legacy services
    setOrganizationIdState(id); // Update the reactive state for components
  };

  const isForcedSuperAdminEmail = (email?: string | null): boolean => {
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    return !!normalized && FORCED_SUPER_ADMIN_EMAILS.has(normalized);
  };

  const resolveSuperAdminSession = async (fallbackOrgId?: string) => {
    let orgs: { id: string; agencyName?: string }[] = [];
    try {
      orgs = await getAllOrganizationsForSuperAdmin();
    } catch (error) {
      console.warn("Failed to load org list from super-admin endpoint, falling back to client read.", error);
      try {
        orgs = await getAllOrganizations();
      } catch (fallbackError) {
        console.warn("Fallback client org read failed. Using assigned org only.", fallbackError);
      }
    }

    if (orgs.length === 0 && fallbackOrgId) {
      orgs = [{ id: fallbackOrgId, agencyName: fallbackOrgId }];
    }
    setAvailableOrganizations(orgs);

    const storedOrgId = localStorage.getItem(SUPER_ADMIN_ACTIVE_ORG_KEY) || "";
    const defaultOrgId = orgs[0]?.id || fallbackOrgId || "";
    const selectedOrgId = orgs.some((org) => org.id === storedOrgId) ? storedOrgId : defaultOrgId;

    updateOrgId(selectedOrgId);
    if (selectedOrgId) {
      localStorage.setItem(SUPER_ADMIN_ACTIVE_ORG_KEY, selectedOrgId);
    } else {
      localStorage.removeItem(SUPER_ADMIN_ACTIVE_ORG_KEY);
    }
    setRole("super_admin");
    console.log(`[Auth-Diagnostic] Super admin resolved. activeOrgId: "${selectedOrgId}"`);
  };

  const switchOrganization = (orgId: string) => {
    if (!orgId) return;
    if (role !== "super_admin" && orgId !== organizationId) return;
    updateOrgId(orgId);
    if (role === "super_admin" && orgId) {
      localStorage.setItem(SUPER_ADMIN_ACTIVE_ORG_KEY, orgId);
    }
  };

  async function bootstrapUserOrganization(user: User, nameHint?: string) {
    const idToken = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE_URL}/bootstrapUserOrganization`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: nameHint || user.displayName || "" }),
    });

    if (!response.ok) {
      let errorMessage = `bootstrap-failed:${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) errorMessage = `bootstrap-failed:${body.error}`;
      } catch {
        // Ignore JSON parsing errors and keep default message.
      }
      throw new Error(errorMessage);
    }

    const body = (await response.json()) as { orgId?: string; role?: string };
    const resolvedOrgId = typeof body.orgId === "string" ? body.orgId : "";
    const resolvedRole = typeof body.role === "string" ? body.role : "owner";
    if (!resolvedOrgId) {
      throw new Error("bootstrap-failed:missing-org-id");
    }

    setAvailableOrganizations([]);
    localStorage.removeItem(SUPER_ADMIN_ACTIVE_ORG_KEY);
    updateOrgId(resolvedOrgId);
    setRole(resolvedRole);
  }

  async function resolveUserOrganizationInternal(user: User, nameHint?: string) {
    const userRef = doc(db, "users", user.uid);
    let userSnap = await getDoc(userRef);

    console.log(`[Auth-Diagnostic] userSnap exists: ${userSnap.exists()}, data:`, userSnap.exists() ? userSnap.data() : "NO DOCUMENT");

    if (isForcedSuperAdminEmail(user.email)) {
      // 1) Cloud Functions use Admin SDK and can write role even before rules allow client writes.
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`${FUNCTIONS_BASE_URL}/listOrganizationsForSuperAdmin`, {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          console.warn(
            `[Auth] listOrganizationsForSuperAdmin returned ${res.status}. Deploy latest functions so this account can sync super_admin from the server.`
          );
        }
      } catch (e) {
        console.warn("[Auth] super-admin org list prefetch failed (network or CORS).", e);
      }

      const existingData = userSnap.exists() ? userSnap.data() : null;
      if (!existingData || existingData.role !== "super_admin") {
        try {
          await setDoc(
            userRef,
            {
              email: user.email,
              name: nameHint || user.displayName || existingData?.name || "Super Admin",
              role: "super_admin",
              createdAt: existingData?.createdAt || new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn(
            "[Auth] Client role upgrade to super_admin failed. Deploy firestore rules (allowlisted self-upgrade) or set role in console.",
            e
          );
        }
      }

      userSnap = await getDoc(userRef);
      const after = userSnap.exists() ? userSnap.data() : null;
      if (after && after.role === "super_admin") {
        await resolveSuperAdminSession(typeof after.orgId === "string" ? after.orgId : "");
        return;
      }
      console.warn(
        "[Auth] Forced super-admin account still not super_admin in Firestore after server + client attempts. " +
          "Deploy: firestore:rules, functions, hosting. Or set users/{uid}.role=super_admin in console."
      );
    }

    // Paco Granados Exception - prioritize this specific customer account only.
    // Super admins must keep their Firestore role and org-switching capabilities.
    const pacoEmails = ["paco.granados@atlascapitalgroup.com"];
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
      const resolvedRole = (data.role as AppRole | string) || "";
      if (resolvedRole === "super_admin") {
        await resolveSuperAdminSession(typeof data.orgId === "string" ? data.orgId : "");
        return;
      }
      if (data.orgId) {
        setRole(resolvedRole);
        setAvailableOrganizations([]);
        localStorage.removeItem(SUPER_ADMIN_ACTIVE_ORG_KEY);
        updateOrgId(data.orgId);
        console.log(`[Auth-Diagnostic] User resolved via Firestore. orgId: "${data.orgId}" role: "${resolvedRole}"`);
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

    await bootstrapUserOrganization(user, nameHint);
  }

  async function resolveUserOrganization(user: User, nameHint?: string) {
    if (resolveInFlightRef.current) {
      await resolveInFlightRef.current;
      return;
    }

    const pending = resolveUserOrganizationInternal(user, nameHint);
    resolveInFlightRef.current = pending;
    try {
      await pending;
    } finally {
      if (resolveInFlightRef.current === pending) {
        resolveInFlightRef.current = null;
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          await resolveUserOrganization(currentUser);
        } catch (error) {
          console.error("Failed to resolve organization:", error);
          // Prevent auth deadlock; keep session usable if org discovery fails.
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef).catch(() => null);
          const orgFallback = userSnap?.exists() ? ((userSnap.data().orgId as string | undefined) || "") : "";
          const roleFallback = userSnap?.exists() ? ((userSnap.data().role as string | undefined) || "") : "";
          if (orgFallback) updateOrgId(orgFallback);
          if (roleFallback) setRole(roleFallback);
          if (orgFallback && roleFallback === "super_admin") {
            setAvailableOrganizations([{ id: orgFallback, agencyName: orgFallback }]);
          }
        }
      } else {
        updateOrgId(""); // Reset to empty when logged out
        setRole("");
        setAvailableOrganizations([]);
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
        availableOrganizations,
        switchOrganization,
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
