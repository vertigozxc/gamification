import Constants from "expo-constants";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { WebView } from "react-native-webview";

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

  if (configured) {
    return configured;
  }

  const host = getBundleHost();
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:5173`;
  }

  return "http://192.168.1.4:5173";
}

export default function WebAppScreen() {
  const [webKey, setWebKey] = useState(0);
  const [errorText, setErrorText] = useState("");
  const webUrl = useMemo(resolveWebAppUrl, []);

  function isGoogleAuthUrl(url) {
    if (!url || typeof url !== "string") {
      return false;
    }

    return (
      url.includes("accounts.google.com") ||
      url.includes("oauth2") ||
      url.includes("__/auth")
    );
  }

  async function openExternal(url = webUrl) {
    try {
      await Linking.openURL(url);
    } catch {
      setErrorText("Could not open external browser. Please open the URL manually.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Google login is blocked inside embedded WebView by Google policy.</Text>
        <Pressable style={styles.bannerButton} onPress={() => openExternal(webUrl)}>
          <Text style={styles.bannerButtonText}>Open Full App In Safari</Text>
        </Pressable>
      </View>

      <WebView
        key={webKey}
        source={{ uri: webUrl }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onShouldStartLoadWithRequest={(request) => {
          if (isGoogleAuthUrl(request?.url)) {
            openExternal(request.url);
            return false;
          }
          return true;
        }}
        onError={(event) => {
          setErrorText(event.nativeEvent?.description || "Failed to load web app");
        }}
        renderLoading={() => (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#22d3ee" />
            <Text style={styles.loadingText}>Loading full app...</Text>
          </View>
        )}
      />

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
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f172a"
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 10,
    fontSize: 14
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
