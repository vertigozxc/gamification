import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import WebAppScreen from "./src/screens/WebAppScreen";
import { installMobileEventLogger } from "./src/eventLogger";

installMobileEventLogger();
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const splashHiddenRef = useRef(false);

  const handleShellReady = useCallback(() => {
    if (splashHiddenRef.current) {
      return;
    }
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    // Safety fallback: never block app forever if shell event is missed.
    const timeoutId = setTimeout(() => {
      handleShellReady();
    }, 12000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [handleShellReady]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <StatusBar style="dark" />
        <WebAppScreen onShellReady={handleShellReady} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9ff"
  }
});
