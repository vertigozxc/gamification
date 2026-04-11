import { useEffect, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "firebase/auth";

function isEmbeddedBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = String(navigator.userAgent || "").toLowerCase();
  return (
    ua.includes("wv") ||
    ua.includes("fb_iab") ||
    ua.includes("instagram") ||
    ua.includes("line/") ||
    ua.includes("webview")
  );
}

function toReadableAuthError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "Google sign-in failed.");

  if (code.includes("auth/operation-not-supported-in-this-environment")) {
    return "Google sign-in is not supported in this embedded browser. Open the app in Safari/Chrome.";
  }

  if (code.includes("auth/unauthorized-domain")) {
    return "Current domain is not authorized in Firebase Auth. Add this host to Firebase Authentication -> Authorized domains.";
  }

  if (message.toLowerCase().includes("requested action is invalid")) {
    return "Google rejected this sign-in request in the current browser context. Try again or open in Safari/Chrome.";
  }

  return message;
}

function useAuthSession({ auth, googleProvider }) {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    // Resolve pending redirect sign-in results.
    getRedirectResult(auth).catch((error) => {
      setAuthError(toReadableAuthError(error));
    });

    return () => unsub();
  }, [auth]);

  async function handleGoogleLogin() {
    try {
      setAuthError("");

      // Popup is unreliable in embedded browsers/WebView, so use redirect there.
      if (isEmbeddedBrowser()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        setAuthError(toReadableAuthError(redirectError || error));
      }
    }
  }

  async function handleLogout(onSuccess) {
    try {
      await signOut(auth);
      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (error) {
      setAuthError(error?.message || "Logout failed.");
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
