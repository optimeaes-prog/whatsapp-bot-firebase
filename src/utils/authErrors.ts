export function mapAuthError(error: unknown, isSignUp: boolean): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (code === "auth/email-already-in-use") {
    return "Este email ya tiene una cuenta. Inicia sesión o usa otro correo.";
  }
  if (code === "auth/invalid-email") {
    return "El formato del email no es válido.";
  }
  if (code === "auth/weak-password") {
    return "La contraseña es demasiado débil. Usa al menos 8 caracteres.";
  }
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Email o contraseña incorrectos.";
  }
  if (code === "auth/user-not-found") {
    return "No encontramos una cuenta con ese email.";
  }
  if (code === "auth/network-request-failed") {
    return "No hay conexión o el servidor no responde. Inténtalo de nuevo.";
  }
  if (code === "auth/too-many-requests") {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Cerraste la ventana de Google antes de completar el acceso.";
  }
  if (message.includes("insufficient permissions") || message.includes("permission-denied")) {
    return isSignUp
      ? "No pudimos terminar de crear tu cuenta. Vuelve a intentarlo en unos segundos."
      : "Tu sesión se creó, pero no pudimos cargar tu organización. Intenta entrar de nuevo.";
  }
  if (message.includes("bootstrap-failed")) {
    return "No pudimos inicializar tu cuenta en este momento. Inténtalo de nuevo.";
  }

  return isSignUp ? "No se pudo crear la cuenta." : "Error de autenticación.";
}
