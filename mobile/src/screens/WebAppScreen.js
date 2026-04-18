import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  AppState,
  Easing,
  Linking,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiBaseUrl } from "../config/env";

const MOBILE_TAB_STORAGE_KEY = "life_rpg_mobile_tab";
const TAB_ITEMS = [
  { key: "city", icon: "business", iconOutline: "business-outline", size: 24 },
  { key: "leaderboard", icon: "trophy", iconOutline: "trophy-outline", size: 24 },
  { key: "dashboard", icon: "grid", iconOutline: "grid-outline", size: 28, center: true },
  { key: "store", icon: "bag-handle", iconOutline: "bag-handle-outline", size: 24 },
  { key: "profile", icon: "person-circle", iconOutline: "person-circle-outline", size: 26 }
];

function normalizeMobileTab(value) {
  const normalized = String(value || "").toLowerCase();
  if (["dashboard", "leaderboard", "city", "store", "profile"].includes(normalized)) {
    return normalized;
  }
  return "dashboard";
}

function buildMobileTabScript(tab) {
  const nextTab = normalizeMobileTab(tab);
  return `
    try {
      window.__LIFE_RPG_MOBILE_TAB__ = ${JSON.stringify(nextTab)};
      localStorage.setItem(${JSON.stringify(MOBILE_TAB_STORAGE_KEY)}, ${JSON.stringify(nextTab)});
      window.dispatchEvent(new CustomEvent("life-rpg-mobile-tab", { detail: ${JSON.stringify(nextTab)} }));
    } catch (e) {}
    true;
  `;
}

function buildThemeObserverScript() {
  return `
    (function() {
      if (window.__THEME_OBSERVER_INSTALLED__) return;
      window.__THEME_OBSERVER_INSTALLED__ = true;
      const bridge = window.ReactNativeWebView;
      if (!bridge) return;
      function sendTheme() {
        if (!document.body) return;
        const computed = getComputedStyle(document.body);
        const b = computed.getPropertyValue('--mobile-tab-bg').trim();
        const a = computed.getPropertyValue('--mobile-tab-active').trim();
        const i = computed.getPropertyValue('--mobile-tab-inactive').trim();
        const o = computed.getPropertyValue('--mobile-tab-orb').trim();
        const ot = computed.getPropertyValue('--mobile-tab-orb-text').trim();
        if (b) {
          bridge.postMessage(JSON.stringify({
            type: 'mobile-theme-update',
            colors: { bg: b, active: a, inactive: i, orb: o, orbText: ot }
          }));
        }
      }
      const observer = new MutationObserver(sendTheme);
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
      window.addEventListener("load", sendTheme);
      setTimeout(sendTheme, 300);
      setTimeout(sendTheme, 1000);
      setTimeout(sendTheme, 2000);
    })();
  `;
}

function buildMobileInsetsScript(offsetPx, safeBottomPx, safeTopPx) {
  const safeOffset = Number.isFinite(offsetPx) ? Math.max(0, Math.round(offsetPx)) : 0;
  const safeBottom = Number.isFinite(safeBottomPx) ? Math.max(0, Math.round(safeBottomPx)) : 0;
  const safeTop = Number.isFinite(safeTopPx) ? Math.max(0, Math.round(safeTopPx)) : 0;
  return `
    try {
      document.documentElement.style.setProperty("--mobile-footer-offset", "${safeOffset}px");
      document.documentElement.style.setProperty("--mobile-safe-bottom", "${safeBottom}px");
      document.documentElement.style.setProperty("--mobile-safe-top", "${safeTop}px");
      if (document.body) {
        document.body.style.setProperty("--mobile-footer-offset", "${safeOffset}px");
        document.body.style.setProperty("--mobile-safe-bottom", "${safeBottom}px");
        document.body.style.setProperty("--mobile-safe-top", "${safeTop}px");
      }
    } catch (e) {}
    true;
  `;
}

function getBundleHost() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL || typeof scriptURL !== "string") {
    return "";
  }

  try {
    const parsed = new URL(scriptURL);
    return parsed.hostname || "";
  } catch {
    return "";
  }
}

function resolveWebAppUrl() {
  const extra = Constants.expoConfig?.extra || {};
  const configured = typeof extra.webAppUrl === "string" ? extra.webAppUrl.trim() : "";
  const host = getBundleHost();

  let base = "http://192.168.70.243:5173";

  if (configured) {
    try {
      const parsed = new URL(configured);
      const configuredHost = parsed.hostname || "";

      if ((configuredHost === "localhost" || configuredHost === "127.0.0.1") && host && host !== "localhost" && host !== "127.0.0.1") {
        parsed.hostname = host;
        base = parsed.toString().replace(/\/$/, "");
      } else {
        base = configured;
      }
    } catch {
      base = configured;
    }
  } else if (host && host !== "localhost" && host !== "127.0.0.1") {
    base = `http://${host}:5173`;
  }

  return `${base}${base.includes("?") ? "&" : "?"}embed=1&authReturn=1`;
}

function createBridgeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveApiBase() {
  try {
    return getApiBaseUrl();
  } catch {
    return "https://life-rpg-api.onrender.com";
  }
}

export default function WebAppScreen() {
  const insets = useSafeAreaInsets();
  const [webKey, setWebKey] = useState(0);
  const [injectedUser, setInjectedUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("");
  const [errorText, setErrorText] = useState("");
  const [showTabBar, setShowTabBar] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState({ bg: "rgba(8, 15, 30, 0.88)", active: "#fbbf24", inactive: "#94a3b8", orb: "#fbbf24", orbText: "#111827" });
  const [pressedTab, setPressedTab] = useState("");
  const bridgeId = useMemo(() => createBridgeId(), []);
  const webUrl = useMemo(() => {
    const baseWithParams = resolveWebAppUrl();
    return `${baseWithParams}&bridgeId=${encodeURIComponent(bridgeId)}`;
  }, [bridgeId]);
  const webViewRef = useRef(null);
  const authInProgressRef = useRef(false);
  const authReloadTriggeredRef = useRef(false);
  const pollTimerRef = useRef(null);
  const authSessionModule = NativeModules?.AuthSessionModule;
  const tabBarAnim = useRef(new Animated.Value(0)).current;
  const safeTopPx = Math.max(0, insets.top);
  const safeBottomPx = Math.max(0, insets.bottom);
  const footerOffsetPx = showTabBar ? (safeBottomPx + 68) : safeBottomPx;
  const tabAnimRefs = useRef(
    Object.fromEntries(TAB_ITEMS.map((item) => [item.key, new Animated.Value(item.key === "dashboard" ? 1 : 0)]))
  ).current;

  function syncMobileTab(nextTab) {
    const normalized = normalizeMobileTab(nextTab);
    setActiveTab(normalized);
    webViewRef.current?.injectJavaScript(buildMobileTabScript(normalized));
  }

  useEffect(() => {
    Animated.parallel(
      TAB_ITEMS.map((item) =>
        Animated.spring(tabAnimRefs[item.key], {
          toValue: item.key === activeTab ? 1 : 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true
        })
      )
    ).start();
  }, [activeTab, tabAnimRefs]);

  useEffect(() => {
    Animated.timing(tabBarAnim, {
      toValue: showTabBar ? 1 : 0,
      duration: showTabBar ? 280 : 180,
      easing: showTabBar ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [showTabBar, tabBarAnim]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(buildMobileInsetsScript(footerOffsetPx, safeBottomPx, safeTopPx));
  }, [footerOffsetPx, safeBottomPx, safeTopPx]);

  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      const deepLink = String(url || "");
      if (deepLink.startsWith("com.liferpg.mobile://auth-complete") || deepLink.startsWith("liferpgmobile://auth-complete")) {
        stopBridgePolling();
        authInProgressRef.current = false;
        setShowTabBar(false);
        triggerAuthReload();
      }
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleDeepLink({ url: initialUrl });
      }
    }).catch(() => {
      // ignore
    });

    const deepLinkSubscription = Linking.addEventListener("url", handleDeepLink);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && authInProgressRef.current) {
        stopBridgePolling();
        authInProgressRef.current = false;
        setShowTabBar(false);
        // Inject a soft refresh instead of full WebView reload
        webViewRef.current?.injectJavaScript(`
          try {
            window.dispatchEvent(new CustomEvent("life-rpg-app-resume"));
          } catch(e) {}
          true;
        `);
      }
    });

    return () => {
      stopBridgePolling();
      deepLinkSubscription?.remove?.();
      appStateSubscription?.remove?.();
    };
  }, []);

  function stopBridgePolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function triggerAuthReload() {
    if (authReloadTriggeredRef.current) {
      return;
    }
    authReloadTriggeredRef.current = true;
    // Mobile is sole driver: poll bridge in background, then inject user
    // into running WebView's localStorage and reload it. Do NOT change
    // webUrl or remount — that would cause spurious page transitions.
    fetchBridgeUserAndInject();
    setTimeout(() => {
      authReloadTriggeredRef.current = false;
    }, 90000);
  }

  async function fetchBridgeUserAndInject() {
    const apiBase = resolveApiBase();
    const url = `${apiBase}/api/auth/mobile-bridge/${encodeURIComponent(bridgeId)}`;
    let user = null;
    let lastStatus = 0;
    let lastError = "";
    setAuthStatus("Auth: starting poll...");
    // Up to ~90s — covers Render free-tier cold start of API
    for (let attempt = 0; attempt < 90 && !user; attempt += 1) {
      try {
        const resp = await fetch(url);
        lastStatus = resp.status;
        if (resp.ok) {
          const body = await resp.json();
          if (body?.user?.uid) {
            user = body.user;
            break;
          }
        }
      } catch (e) {
        lastError = String(e?.message || e || "network");
      }
      setAuthStatus(`Auth: poll ${attempt + 1}/90 status=${lastStatus}${lastError ? " err=" + lastError : ""}`);
      // Inject heartbeat into webview every few attempts so dev can see polling is alive
      if (attempt % 5 === 0) {
        const msg = `auth-poll attempt=${attempt} status=${lastStatus} err=${lastError}`;
        webViewRef.current?.injectJavaScript(`try{console.log(${JSON.stringify("[mobile] " + msg)});}catch(e){}true;`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (user) {
      setAuthStatus(`Auth: got user ${user.email || user.uid}, reloading...`);
      // Inject user into localStorage of running WebView and force reload.
      const userJson = JSON.stringify(user);
      const script = `
        try {
          localStorage.setItem("life_rpg_mobile_embedded_session", ${JSON.stringify(userJson)});
          console.log("[mobile] auth user injected, reloading");
          window.location.reload();
        } catch (e) {
          console.log("[mobile] inject failed: " + e.message);
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(script);
      setInjectedUser(user);
      setTimeout(() => setAuthStatus(""), 4000);
    } else {
      setAuthStatus(`Auth FAILED: bridge never arrived (last status=${lastStatus})`);
      // Bridge never materialized — just remount so user can retry login.
      webViewRef.current?.injectJavaScript(`try{console.log("[mobile] auth bridge never arrived (last status=${lastStatus})");}catch(e){}true;`);
      setWebKey((k) => k + 1);
      setTimeout(() => setAuthStatus(""), 8000);
    }
  }

  function startBridgePolling() {
    stopBridgePolling();
    const apiBase = resolveApiBase();
    let attempts = 0;
    pollTimerRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts > 30) { // 60 seconds max
        stopBridgePolling();
        return;
      }
      try {
        const resp = await fetch(`${apiBase}/api/auth/mobile-bridge-check/${encodeURIComponent(bridgeId)}`);
        if (resp.ok) {
          const body = await resp.json();
          if (body.exists) {
            stopBridgePolling();
            authInProgressRef.current = false;
            triggerAuthReload();
          }
        }
      } catch {
        // server unreachable, keep trying
      }
    }, 2000);
  }

  async function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "mobile-theme-update") {
        setTheme(data.colors);
        return;
      }
      if (data?.type === "google-login-request") {
        const returnScheme = "com.liferpg.mobile";
        const redirectUri = `${resolveApiBase()}/api/auth/google-callback`;
        const clientId = "381152713640-o1cnhofvud2lna05gbor9o5cnplfm2e1.apps.googleusercontent.com";
        const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const state = JSON.stringify({ bridgeId, returnScheme });

        // Build Google OAuth URL directly — iOS prompt shows "google.com wants to sign in".
        // Server exchanges the returned id_token for a Firebase UID so mobile and web share identity.
        const googleParams = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "id_token",
          scope: "openid email profile",
          nonce,
          state,
          prompt: "select_account"
        });
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`;
        authInProgressRef.current = true;

        // Start polling the bridge as a fallback (catches auth even if redirect fails)
        startBridgePolling();

        if (authSessionModule && typeof authSessionModule.openAuthSession === "function") {
          try {
            setAuthStatus("Auth: opening Google...");
            const result = await authSessionModule.openAuthSession(authUrl, returnScheme);
            stopBridgePolling();
            authInProgressRef.current = false;
            if (!result?.cancelled) {
              setAuthStatus("Auth: Google done, fetching session...");
              triggerAuthReload();
            } else {
              setAuthStatus("Auth: cancelled");
              setTimeout(() => setAuthStatus(""), 3000);
            }
            return;
          } catch (e) {
            setAuthStatus(`Auth ERROR: ${String(e?.message || e)}`);
            setTimeout(() => setAuthStatus(""), 5000);
            // fallback to Linking below
          }
        }

        await Linking.openURL(authUrl);
      }

      if (data?.type === "mobile-shell-state") {
        setShowTabBar(Boolean(data?.showTabBar));
        if (data?.activeTab) {
          setActiveTab(normalizeMobileTab(data.activeTab));
        }
      }

      if (data?.type === "auth-debug" && String(data?.message || "").toLowerCase().includes("retrieved mobile session")) {
        stopBridgePolling();
        authInProgressRef.current = false;
      }
    } catch {
      // ignore non-JSON messages
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        key={webKey}
        source={{ uri: webUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        bounces={false}
        scrollEnabled
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        onMessage={handleWebViewMessage}
        onShouldStartLoadWithRequest={() => true}
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(buildMobileTabScript(activeTab));
          webViewRef.current?.injectJavaScript(buildMobileInsetsScript(footerOffsetPx, safeBottomPx, safeTopPx));
          webViewRef.current?.injectJavaScript(buildThemeObserverScript());
        }}
        injectedJavaScriptBeforeContentLoaded={`
          try {
            window.__LIFE_RPG_MOBILE_TAB__ = ${JSON.stringify(activeTab)};
            localStorage.setItem(${JSON.stringify(MOBILE_TAB_STORAGE_KEY)}, ${JSON.stringify(activeTab)});
            ${injectedUser ? `localStorage.setItem("life_rpg_mobile_embedded_session", ${JSON.stringify(JSON.stringify(injectedUser))});` : ""}
            document.documentElement.style.setProperty("--mobile-footer-offset", "${Math.round(footerOffsetPx)}px");
            document.documentElement.style.setProperty("--mobile-safe-bottom", "${Math.max(0, Math.round(safeBottomPx))}px");
            document.documentElement.style.setProperty("--mobile-safe-top", "${Math.max(0, Math.round(safeTopPx))}px");
            document.documentElement.style.background = "#020617";
            document.documentElement.style.overscrollBehavior = "none";
            document.documentElement.style.height = "100%";
            document.documentElement.style.minHeight = "100%";
            if (document.body) {
              document.body.style.setProperty("--mobile-footer-offset", "${Math.round(footerOffsetPx)}px");
              document.body.style.setProperty("--mobile-safe-bottom", "${Math.max(0, Math.round(safeBottomPx))}px");
              document.body.style.setProperty("--mobile-safe-top", "${Math.max(0, Math.round(safeTopPx))}px");
              document.body.style.background = "#020617";
              document.body.style.margin = "0";
              document.body.style.height = "100%";
              document.body.style.minHeight = "100%";
              document.body.style.overscrollBehavior = "none";
            }
            const root = document.getElementById("root");
            if (root) {
              root.style.minHeight = "100%";
            }
          } catch(e) {}
          true;
        `}
        onError={(event) => {
          setErrorText(event.nativeEvent?.description || "Failed to load web app");
        }}
      />

      {showTabBar ? (
        <>
          <Animated.View
            style={[
              styles.tabBarWrap,
              {
                bottom: 0,
                paddingBottom: Math.max(2, insets.bottom + 2),
                opacity: tabBarAnim,
                transform: [{ translateY: tabBarAnim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }]
              }
            ]}
            pointerEvents="box-none"
          >
            <View style={[styles.tabBar, { backgroundColor: theme.bg }]}>
            {TAB_ITEMS.map((item) => {
              const anim = tabAnimRefs[item.key];
              const isActive = activeTab === item.key;
              const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, item.center ? 1.08 : 1.12] });
              const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, item.center ? -3 : -1] });
              const haloOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

              return (
                <Pressable
                  key={item.key}
                  style={[styles.tabButton, item.center ? styles.centerTabButton : null]}
                  onPress={() => syncMobileTab(item.key)}
                  onPressIn={() => setPressedTab(item.key)}
                  onPressOut={() => setPressedTab("")}
                  android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: true }}
                >
                  <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
                    {item.center ? (
                      <View style={styles.centerTabWrap}>
                        <View style={[styles.centerTabOrb, { backgroundColor: theme.orb }, isActive ? { backgroundColor: theme.orb } : null, pressedTab === item.key ? styles.centerTabOrbPressed : null]}>
                          <Ionicons name={isActive ? item.icon : (item.iconOutline || item.icon)} size={item.size} color={theme.orbText} />
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.iconSlot, pressedTab === item.key ? styles.iconSlotPressed : null]}>
                        <Animated.View style={[styles.activePill, { backgroundColor: theme.active + "22", opacity: haloOpacity, transform: [{ scaleX: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }, { scaleY: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]} />
                        <Ionicons name={isActive ? item.icon : item.iconOutline} size={item.size} color={isActive ? theme.active : theme.inactive} />
                      </View>
                    )}
                  </Animated.View>
                </Pressable>
              );
            })}
            </View>
          </Animated.View>
        </>
      ) : null}

      {!!errorText && (
        <View style={styles.errorPanel}>
          <Text style={styles.errorTitle}>Connection issue</Text>
          <Text style={styles.errorText}>{errorText}</Text>
          <Text style={styles.errorHint}>Web URL: {webUrl}</Text>
          <Pressable style={styles.retryButton} onPress={() => { setErrorText(""); setWebKey((k) => k + 1); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617"
  },
  banner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    gap: 8
  },
  bannerText: {
    color: "#fef3c7",
    fontSize: 12,
    lineHeight: 16
  },
  bannerButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0284c7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  bannerButtonText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 12
  },
  webview: {
    flex: 1,
    backgroundColor: "#020617"
  },
  tabBarWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    alignItems: "center"
  },

  tabBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: "rgba(8, 15, 30, 0.88)",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10
  },
  tabButton: {
    flex: 1,
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center"
  },
  iconSlot: {
    width: 44,
    height: 31,
    alignItems: "center",
    justifyContent: "center"
  },
  iconSlotPressed: {
    opacity: 0.85
  },
  activePill: {
    position: "absolute",
    width: 42,
    height: 31,
    borderRadius: 15.5,
    backgroundColor: "rgba(251, 191, 36, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.28)"
  },
  centerTabButton: {
    flex: 1.05
  },
  centerTabWrap: {
    width: 54,
    height: 60,
    alignItems: "center",
    justifyContent: "center"
  },
  centerTabOrb: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "rgba(251, 191, 36, 0.48)",
    backgroundColor: "#111827",
    transform: [{ translateY: -10 }],
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4
  },
  centerTabOrbPressed: {
    opacity: 0.9,
    transform: [{ translateY: -8 }, { scale: 0.98 }]
  },
  centerTabOrbActive: {
    backgroundColor: "#fbbf24",
    borderColor: "#fde68a"
  },
  errorPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#111827",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  errorTitle: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  errorText: {
    color: "#fecaca",
    fontSize: 12
  },
  errorHint: {
    color: "#93c5fd",
    fontSize: 12
  },
  retryButton: {
    backgroundColor: "#0284c7",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center"
  },
  retryButtonText: {
    color: "#f8fafc",
    fontWeight: "700"
  }
});