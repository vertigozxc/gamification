import { useEffect, useRef, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";
import { retrieveMobileAuthTokenByBridge, storeMobileAuthToken } from "../api";

function resolveApiBaseForAuth() {
  if (typeof window === "undefined") {
    return "http://localhost:4000";
  }
  const protocol = window.location.protocol || "http:";
  const host = window.location.hostname || "localhost";
  return `${protocol}//${host}:4000`;
}

const MOBILE_EMBEDDED_SESSION_KEY = "life_rpg_mobile_embedded_session";
const EXTERNAL_AUTOSTART_MARKER_KEY = "life_rpg_external_autostart_done";
const EXTERNAL_AUTH_CONTEXT_KEY = "life_rpg_external_auth_context";

function isEmbeddedBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("embed") === "1") {
      return true;
    }
  } catch {
    // ignore
  }

  const ua = String(navigator?.userAgent || "").toLowerCase();
  return ua.includes("wv") || ua.includes("webview") || ua.includes("fb_iab") || ua.includes("instagram");
}

function isExternalAuthMode() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("authMode") === "external";
  } catch {
    return false;
  }
}

function getAuthBridgeId() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("bridgeId") || "").trim();
  } catch {
    return "";
  }
}

function readExternalAuthContext() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(EXTERNAL_AUTH_CONTEXT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      bridgeId: String(parsed.bridgeId || "").trim(),
      returnScheme: String(parsed.returnScheme || "com.liferpg.mobile").trim() || "com.liferpg.mobile",
      authNonce: String(parsed.authNonce || "").trim()
    };
  } catch {
    return null;
  }
}

function writeExternalAuthContext({ bridgeId = "", returnScheme = "com.liferpg.mobile", authNonce = "" } = {}) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(EXTERNAL_AUTH_CONTEXT_KEY, JSON.stringify({
      bridgeId: String(bridgeId || "").trim(),
      returnScheme: String(returnScheme || "com.liferpg.mobile").trim() || "com.liferpg.mobile",
      authNonce: String(authNonce || "").trim()
    }));
  } catch {
    // ignore
  }
}

function clearExternalAuthContext() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(EXTERNAL_AUTH_CONTEXT_KEY);
  } catch {
    // ignore
  }
}

function shouldAutostartExternalAuth() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("authMode") === "external" && params.get("autostart") === "1";
  } catch {
    return false;
  }
}

function getAuthNonce() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("authNonce") || "").trim();
  } catch {
    return "";
  }
}

function getReturnScheme() {
  if (typeof window === "undefined") {
    return "com.liferpg.mobile";
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const value = String(params.get("returnScheme") || "").trim();
    return value || "com.liferpg.mobile";
  } catch {
    return "com.liferpg.mobile";
  }
}

function getResolvedExternalAuthContext() {
  const bridgeId = getAuthBridgeId();
  const returnScheme = getReturnScheme();
  const authNonce = getAuthNonce();
  const stored = readExternalAuthContext();

  return {
    bridgeId: bridgeId || stored?.bridgeId || "",
    returnScheme: returnScheme || stored?.returnScheme || "com.liferpg.mobile",
    authNonce: authNonce || stored?.authNonce || ""
  };
}

function getExternalAutostartMarker(bridgeId, authNonce = "") {
  return `${EXTERNAL_AUTOSTART_MARKER_KEY}:${bridgeId || "default"}:${authNonce || "none"}`;
}

function markExternalAutostartDone(bridgeId, authNonce = "") {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(getExternalAutostartMarker(bridgeId, authNonce), "1");
  } catch {
    // ignore
  }
}

function wasExternalAutostartDone(bridgeId, authNonce = "") {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(getExternalAutostartMarker(bridgeId, authNonce)) === "1";
  } catch {
    return false;
  }
}

function clearExternalAutostartMarker(bridgeId, authNonce = "") {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(getExternalAutostartMarker(bridgeId, authNonce));
  } catch {
    // ignore
  }
}

function toSafeAuthUser(userLike) {
  if (!userLike?.uid) {
    return null;
  }

  return {
    uid: String(userLike.uid),
    displayName: String(userLike.displayName || userLike.email || "Adventurer"),
    email: String(userLike.email || ""),
    photoURL: String(userLike.photoURL || "")
  };
}

function toReadableAuthError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "Google sign-in failed.");

  if (code.includes("auth/operation-not-supported-in-this-environment")) {
    return "Google sign-in is not supported in embedded browser. Use external auth flow.";
  }

  if (code.includes("auth/unauthorized-domain")) {
    return "Current domain is not authorized in Firebase Auth. Add this host in Firebase Authentication -> Authorized domains.";
  }

  if (code.includes("auth/popup-blocked")) {
    return "Popup was blocked. Try again.";
  }

  return message;
}

function readEmbeddedSessionUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MOBILE_EMBEDDED_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return toSafeAuthUser(parsed);
  } catch {
    return null;
  }
}

function saveEmbeddedSessionUser(userLike) {
  if (typeof window === "undefined") {
    return;
  }

  const safeUser = toSafeAuthUser(userLike);
  if (!safeUser) {
    return;
  }

  try {
    window.localStorage.setItem(MOBILE_EMBEDDED_SESSION_KEY, JSON.stringify(safeUser));
  } catch {
    // ignore storage errors
  }
}

function clearEmbeddedSessionUser() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(MOBILE_EMBEDDED_SESSION_KEY);
  } catch {
    // ignore
  }
}

function clearFirebaseStorageArtifacts() {
  if (typeof window === "undefined") {
    return;
  }

  for (const store of [window.localStorage, window.sessionStorage]) {
    if (!store) {
      continue;
    }

    const keysToRemove = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i) || "";
      if (key.startsWith("firebase:authUser:") || key.startsWith("firebase:redirectUser:")) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => store.removeItem(key));
  }
}

function useAuthSession({ auth, googleProvider, firebaseInitError = "" }) {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loggedOut, setLoggedOut] = useState(false);

  const bridgeLookupInFlightRef = useRef(false);
  const externalRedirectStartedRef = useRef(false);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      if (firebaseInitError) {
        setAuthError(firebaseInitError);
      }
      return undefined;
    }

    setAuthLoading(true);

    if (!loggedOut && isEmbeddedBrowser()) {
      const persistedUser = readEmbeddedSessionUser();
      if (persistedUser?.uid) {
        setAuthUser(persistedUser);
        setAuthLoading(false);
      }
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const safeUser = toSafeAuthUser(user);
        if (isEmbeddedBrowser()) {
          saveEmbeddedSessionUser(safeUser);
        }

        const externalContext = getResolvedExternalAuthContext();

        if (isExternalAuthMode() || externalContext.bridgeId) {
          const bridgeId = externalContext.bridgeId;
          if (bridgeId) {
            try {
              await storeMobileAuthToken(safeUser, bridgeId);
              const returnScheme = externalContext.returnScheme;
              const apiBase = resolveApiBaseForAuth();
              // Use server HTTP 302 redirect — reliably intercepted by ASWebAuthenticationSession
              clearExternalAuthContext();
              window.location.replace(`${apiBase}/api/auth/mobile-complete?bridgeId=${encodeURIComponent(bridgeId)}&scheme=${encodeURIComponent(returnScheme)}`);
            } catch (storeErr) {
              // Last-resort: try direct deep link
              try {
                const returnScheme = externalContext.returnScheme;
                clearExternalAuthContext();
                window.location.replace(`${returnScheme}://auth-complete?bridgeId=${encodeURIComponent(bridgeId)}`);
              } catch {
                // ignore
              }
            }
          }
        }

        setAuthUser(safeUser);
        setAuthLoading(false);
        return;
      }

      if (!loggedOut && isEmbeddedBrowser()) {
        const persistedUser = readEmbeddedSessionUser();
        if (persistedUser?.uid) {
          setAuthUser(persistedUser);
          setAuthLoading(false);
          return;
        }

        const bridgeId = getAuthBridgeId();
        if (bridgeId && !bridgeLookupInFlightRef.current) {
          bridgeLookupInFlightRef.current = true;
          try {
            const response = await retrieveMobileAuthTokenByBridge(bridgeId);
            const bridgedUser = toSafeAuthUser(response?.user);
            if (bridgedUser) {
              saveEmbeddedSessionUser(bridgedUser);
              setAuthUser(bridgedUser);
              setAuthLoading(false);
              return;
            }
          } catch {
            // nothing yet from external browser, remain unauthenticated
          } finally {
            bridgeLookupInFlightRef.current = false;
          }
        }
      }

      setAuthUser(null);
      setAuthLoading(false);
    });

    const externalContextForAutostart = getResolvedExternalAuthContext();
    const bridgeIdForAutostart = externalContextForAutostart.bridgeId;
    const authNonceForAutostart = externalContextForAutostart.authNonce;
    if (
      googleProvider &&
      shouldAutostartExternalAuth() &&
      isExternalAuthMode() &&
      !isEmbeddedBrowser() &&
      !externalRedirectStartedRef.current &&
      !wasExternalAutostartDone(bridgeIdForAutostart, authNonceForAutostart)
    ) {
      externalRedirectStartedRef.current = true;
      writeExternalAuthContext(externalContextForAutostart);
      markExternalAutostartDone(bridgeIdForAutostart, authNonceForAutostart);
      signInWithRedirect(auth, googleProvider).catch((error) => {
        externalRedirectStartedRef.current = false;
        setAuthError(toReadableAuthError(error));
        setAuthLoading(false);
      });
    }

    // Resolve pending redirect result first. In external auth mode,
    // launch redirect only when there is no redirect result user yet.
    getRedirectResult(auth)
      .then(async (result) => {
        const externalContext = getResolvedExternalAuthContext();
        const bridgeId = externalContext.bridgeId;
        const authNonce = externalContext.authNonce;
        if (result?.user) {
          const safeUser = toSafeAuthUser(result.user);
          setAuthUser(safeUser);
          setAuthLoading(false);
          externalRedirectStartedRef.current = false;
          clearExternalAutostartMarker(bridgeId, authNonce);

          // In external auth mode, also trigger the redirect here (redundancy with onAuthStateChanged)
          if ((isExternalAuthMode() || bridgeId) && bridgeId) {
            try {
              await storeMobileAuthToken(safeUser, bridgeId);
              const returnScheme = externalContext.returnScheme;
              const apiBase = resolveApiBaseForAuth();
              clearExternalAuthContext();
              window.location.replace(`${apiBase}/api/auth/mobile-complete?bridgeId=${encodeURIComponent(bridgeId)}&scheme=${encodeURIComponent(returnScheme)}`);
            } catch {
              try {
                const returnScheme = externalContext.returnScheme;
                clearExternalAuthContext();
                window.location.replace(`${returnScheme}://auth-complete?bridgeId=${encodeURIComponent(bridgeId)}`);
              } catch {
                // ignore
              }
            }
          }
          return;
        }
      })
      .catch((error) => {
        setAuthError(toReadableAuthError(error));
        setAuthLoading(false);
      });

    return () => {
      unsub();
    };
  }, [auth, googleProvider, firebaseInitError, loggedOut]);

  async function handleGoogleLogin() {
    if (!auth || !googleProvider) {
      setAuthError(firebaseInitError || "Google sign-in is not configured.");
      return;
    }

    setAuthError("");
    setLoggedOut(false);

    if (isEmbeddedBrowser()) {
      try {
        const bridge = window.ReactNativeWebView;
        if (bridge && typeof bridge.postMessage === "function") {
          bridge.postMessage(JSON.stringify({ type: "google-login-request" }));
          return;
        }
      } catch {
        // ignore and try redirect fallback
      }

      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (error) {
        setAuthError(toReadableAuthError(error));
      }
      return;
    }

    if (isExternalAuthMode()) {
      try {
        writeExternalAuthContext(getResolvedExternalAuthContext());
        await signInWithRedirect(auth, googleProvider);
      } catch (error) {
        setAuthError(toReadableAuthError(error));
      }
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (popupError) {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        setAuthError(toReadableAuthError(redirectError || popupError));
      }
    }
  }

  async function handleLogout(onSuccess) {
    if (!auth) {
      setAuthError(firebaseInitError || "Logout is unavailable until Firebase is configured.");
      return;
    }

    try {
      setLoggedOut(true);
      setAuthError("");
      setAuthUser(null);
      clearEmbeddedSessionUser();
      clearFirebaseStorageArtifacts();
      await signOut(auth);
      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (error) {
      setAuthError(toReadableAuthError(error));
    }
  }

  return {
    authUser,
    setAuthUser,
    authLoading,
    authError,
    setAuthError,
    handleGoogleLogin,
    handleLogout
  };
}

export default useAuthSession;
