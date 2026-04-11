import Constants from "expo-constants";
import { NativeModules } from "react-native";

function pickBundleHost() {
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

function toApiBase(host) {
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return "";
  }
  return `http://${host}:4000`;
}

export function getApiBaseUrl() {
  const extra = Constants.expoConfig?.extra || {};
  const configured = typeof extra.apiBaseUrl === "string" ? extra.apiBaseUrl.trim() : "";
  const hostFromBundle = pickBundleHost();
  const inferredFromBundle = toApiBase(hostFromBundle);

  // In Expo Go dev flow this is usually the most reliable host for phone -> laptop API calls.
  if (inferredFromBundle) {
    return inferredFromBundle;
  }

  if (configured) {
    return configured;
  }

  return "http://localhost:4000";
}
