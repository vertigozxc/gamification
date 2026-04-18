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
  if (!host) {
    return "";
  }
  return `http://${host}:4000`;
}

export function getApiBaseUrl() {
  const extra = Constants.expoConfig?.extra || {};
  const configured = typeof extra.apiBaseUrl === "string" ? extra.apiBaseUrl.trim() : "";
  const hostFromBundle = pickBundleHost();
  const inferredFromBundle = toApiBase(hostFromBundle);

  if (configured) {
    try {
      const parsed = new URL(configured);
      const configuredHost = parsed.hostname || "";

      if ((configuredHost === "localhost" || configuredHost === "127.0.0.1") && inferredFromBundle) {
        return inferredFromBundle;
      }
    } catch {
      // ignore malformed configured URL
    }

    return configured;
  }

  if (inferredFromBundle) {
    return inferredFromBundle;
  }

  return "https://api.life-rpg.app";
}
