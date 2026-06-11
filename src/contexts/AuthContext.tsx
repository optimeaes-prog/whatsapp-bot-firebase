/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { doc, getDoc } from "firebase/firestore";
import { analytics, hashIdSync } from "../lib/analytics";
import { setOrganizationId } from "../lib/organization";
import { getAllOrganizations, getAllOrganizationsForSuperAdmin } from "../services/organization";
import { FUNCTIONS_BASE_URL } from "../lib/api";

type AppRole = "owner" | "admin" | "member" | "agent" | "super_admin" | "";

export type ImpersonationSession = {
  uid: string;
  role: AppRole | string;
  email?: string;
  displayName?: string;
};


function normalizeImpersonatedRole(value: unknown): AppRole | string {
  const r = typeof value === "string" ? value.trim() : "";
  if (r === "owner" || r === "admin" || r === "member" || r === "agent" || r === "super_admin") return r;
  return r || "member";
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
  organizationId: string;
  /** Firestore app role for the signed-in user (not overridden by impersonation). */
  role: AppRole | string;
  effectiveRole: AppRole | string;
  effectiveUid: string;
  impersonation: ImpersonationSession | null;
  isImpersonating: boolean;
  isImpersonationReadOnly: boolean;
  startImpersonation: (targetUid: string) => Promise<void>;
  clearImpersonation: () => void;
  availableOrganizations: { id: string; agencyName?: string }[];
  switchOrganization: (orgId: string) => void;
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
  const [role, setRole] = useState<AppRole | string>("");
  const [impersonation, setImpersonation] = useState<ImpersonationSession | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<{ id: string; agencyName?: string }[]>([]);
  const resolveInFlightRef = useRef<Promise<void> | null>(null);
  const roleRef = useRef<AppRole | string>("");
  const orgIdRef = useRef<string>("");

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    orgIdRef.current = organizationId;
  }, [organizationId]);

  const updateOrgId = (id: string) => {
    setOrganizationId(id); // Update the global non-reactive variable for legacy services
    setOrganizationIdState(id); // Update the reactive state for components
  };

  // Impersonation and super-admin active-org state are kept in React state only
  // (no localStorage / sessionStorage). This means a page reload ends impersonation
  // and resets the super-admin's active org to the default — a deliberate trade-off
  // to keep these tokens out of reach of any XSS that might land on the page.
  const clearImpersonation = useCallback(() => {
    setImpersonation(null);
  }, []);

  const startImpersonation = useCallback(
    async (targetUid: string) => {
      const trimmed = targetUid.trim();
      if (!trimmed) throw new Error("Usuario no válido");
      if (roleRef.current !== "super_admin") throw new Error("Solo los super-administradores pueden usar esta función");
      const me = auth.currentUser?.uid;
      if (me && trimmed === me) throw new Error("No puedes ver la app como tu propio usuario");
      const org = orgIdRef.current;
      if (!org) throw new Error("Selecciona una organización primero");

      const snap = await getDoc(doc(db, "users", trimmed));
      if (!snap.exists()) throw new Error("Usuario no encontrado");
      const data = snap.data();
      const targetOrgId = typeof data.orgId === "string" ? data.orgId : "";
      if (targetOrgId !== org) throw new Error("El usuario no pertenece a la organización activa");

      const next: ImpersonationSession = {
        uid: trimmed,
        role: normalizeImpersonatedRole(data.role),
        email: typeof data.email === "string" ? data.email : undefined,
        displayName:
          (typeof data.name === "string" && data.name) ||
          (typeof data.displayName === "string" && data.displayName) ||
          undefined,
      };
      setImpersonation(next);
    },
    []
  );

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

    // Active org is kept in React state only — on reload, default to the
    // first org in the list (or the fallback if list is empty).
    const selectedOrgId = orgs[0]?.id || fallbackOrgId || "";
    updateOrgId(selectedOrgId);
    setRole("super_admin");
    console.log(`[Auth-Diagnostic] Super admin resolved. activeOrgId: "${selectedOrgId}"`);
  };

  const switchOrganization = useCallback(
    (orgId: string) => {
      if (!orgId) return;
      const r = roleRef.current;
      const currentOrg = orgIdRef.current;
      if (r !== "super_admin" && orgId !== currentOrg) return;
      if (r === "super_admin") {
        setImpersonation(null);
      }
      updateOrgId(orgId);
    },
    []
  );

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
    updateOrgId(resolvedOrgId);
    setRole(resolvedRole);
  }

  async function resolveUserOrganizationInternal(user: User, nameHint?: string) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    console.log(`[Auth-Diagnostic] userSnap exists: ${userSnap.exists()}, data:`, userSnap.exists() ? userSnap.data() : "NO DOCUMENT");

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
        updateOrgId(data.orgId);
        console.log(`[Auth-Diagnostic] User resolved via Firestore. orgId: "${data.orgId}" role: "${resolvedRole}"`);
        return;
      }
    }

    // Invitation fallback: if user is already logged in and opens a token link,
    // accept it and attach the account to the org/role.
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
        setImpersonation(null);
      }
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (role && role !== "super_admin" && impersonation) {
      clearImpersonation();
    }
  }, [role, impersonation, clearImpersonation]);

  // Set user_id + non-PII user_properties in GA4 once we have the full session.
  // Re-runs when org or role changes (e.g. super_admin switches org).
  useEffect(() => {
    if (!user?.uid) return;
    analytics.identify({
      user_id: user.uid,
      role: typeof role === "string" ? role : undefined,
      org_id_hash: organizationId ? hashIdSync(organizationId) : undefined,
    });
  }, [user?.uid, role, organizationId]);

  const signIn = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await resolveUserOrganization(result.user);
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
    setImpersonation(null);
    await firebaseSignOut(auth);
    analytics.trackLogout();
    analytics.reset();
  };

  const isImpersonating = impersonation !== null;
  const isImpersonationReadOnly = isImpersonating;
  const effectiveRole = impersonation?.role && String(impersonation.role).length > 0 ? impersonation.role : role;
  const effectiveUid = impersonation?.uid ? impersonation.uid : user?.uid ?? "";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        organizationId,
        role,
        effectiveRole,
        effectiveUid,
        impersonation,
        isImpersonating,
        isImpersonationReadOnly,
        startImpersonation,
        clearImpersonation,
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
