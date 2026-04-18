import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

function Tower({ height, width, style }) {
  return <View style={[styles.tower, { height, width }, style]} />;
}

export default function PortalPreloader({ title = "Summoning Portal...", caption = "" }) {
  const pulse = useRef(new Animated.Value(0.92)).current;
  const rotateOuter = useRef(new Animated.Value(0)).current;
  const rotateMiddle = useRef(new Animated.Value(0)).current;
  const rotateInner = useRef(new Animated.Value(0)).current;
  const rotateOrbitA = useRef(new Animated.Value(0)).current;
  const rotateOrbitB = useRef(new Animated.Value(0)).current;
  const rotateOrbitC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    const outerLoop = Animated.loop(
      Animated.timing(rotateOuter, {
        toValue: 1,
        duration: 7200,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    const middleLoop = Animated.loop(
      Animated.timing(rotateMiddle, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    const innerLoop = Animated.loop(
      Animated.timing(rotateInner, {
        toValue: 1,
        duration: 3800,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    const orbitLoop = (value, duration, reverse = false) => Animated.loop(
      Animated.timing(value, {
        toValue: reverse ? -1 : 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    const orbitA = orbitLoop(rotateOrbitA, 18000, false);
    const orbitB = orbitLoop(rotateOrbitB, 24000, true);
    const orbitC = orbitLoop(rotateOrbitC, 30000, false);

    pulseLoop.start();
    outerLoop.start();
    middleLoop.start();
    innerLoop.start();
    orbitA.start();
    orbitB.start();
    orbitC.start();

    return () => {
      pulseLoop.stop();
      outerLoop.stop();
      middleLoop.stop();
      innerLoop.stop();
      orbitA.stop();
      orbitB.stop();
      orbitC.stop();
      pulse.stopAnimation();
      rotateOuter.stopAnimation();
      rotateMiddle.stopAnimation();
      rotateInner.stopAnimation();
      rotateOrbitA.stopAnimation();
      rotateOrbitB.stopAnimation();
      rotateOrbitC.stopAnimation();
    };
  }, [pulse, rotateInner, rotateMiddle, rotateOuter, rotateOrbitA, rotateOrbitB, rotateOrbitC]);

  const outerSpin = rotateOuter.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });
  const middleSpin = rotateMiddle.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"]
  });
  const innerSpin = rotateInner.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });
  const orbitASpin = rotateOrbitA.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });
  const orbitBSpin = rotateOrbitB.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-360deg", "0deg", "360deg"]
  });
  const orbitCSpin = rotateOrbitC.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  return (
    <View style={styles.container}>
      <View style={styles.scene}>
        <View style={[styles.aurora, styles.auroraLeft]} />
        <View style={[styles.aurora, styles.auroraRight]} />
        <View style={styles.stars} />
        <View style={styles.cityline}>
          <Tower height={42} width={18} />
          <Tower height={58} width={22} style={{ marginLeft: 6 }} />
          <Tower height={34} width={14} style={{ marginLeft: 7 }} />
          <Tower height={72} width={26} style={{ marginLeft: 8 }} />
          <Tower height={48} width={16} style={{ marginLeft: 8 }} />
          <Tower height={56} width={20} style={{ marginLeft: 7 }} />
        </View>

        <View style={styles.platform} />
        <View style={styles.beam} />

        <Animated.View style={[styles.ring, styles.ringOuter, { transform: [{ rotate: outerSpin }] }]} />
        <Animated.View style={[styles.ring, styles.ringMiddle, { transform: [{ rotate: middleSpin }] }]} />
        <Animated.View style={[styles.ring, styles.ringInner, { transform: [{ rotate: innerSpin }] }]} />

        <Animated.View style={[styles.coreWrap, { transform: [{ scale: pulse }] }]}>
          <View style={styles.coreGlow} />
          <View style={styles.core}>
            <View style={styles.sigilInner} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.orbit, styles.orbitA, { transform: [{ rotate: orbitASpin }] }]}>
          <View style={[styles.orbitDot, styles.orbitDotA]} />
        </Animated.View>
        <Animated.View style={[styles.orbit, styles.orbitB, { transform: [{ rotate: orbitBSpin }] }]}>
          <View style={[styles.orbitDot, styles.orbitDotB]} />
        </Animated.View>
        <Animated.View style={[styles.orbit, styles.orbitC, { transform: [{ rotate: orbitCSpin }] }]}>
          <View style={[styles.orbitDot, styles.orbitDotC]} />
        </Animated.View>
      </View>

      <Text style={styles.title}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    paddingHorizontal: 24
  },
  scene: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22
  },
  aurora: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    opacity: 0.65
  },
  auroraLeft: {
    left: "14%",
    top: "12%",
    backgroundColor: "rgba(56, 189, 248, 0.24)"
  },
  auroraRight: {
    right: "14%",
    top: "8%",
    backgroundColor: "rgba(251, 191, 36, 0.18)"
  },
  stars: {
    position: "absolute",
    width: "45%",
    height: "45%",
    top: "18%",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderRadius: 999,
    opacity: 0.2
  },
  cityline: {
    position: "absolute",
    bottom: "18%",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    opacity: 0.9
  },
  tower: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 0
  },
  platform: {
    position: "absolute",
    bottom: "13%",
    width: "56%",
    height: "6%",
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.22)"
  },
  beam: {
    position: "absolute",
    width: "28%",
    height: "62%",
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 }
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderStyle: "solid"
  },
  ringOuter: {
    width: "58%",
    height: "58%",
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.34)",
    borderTopColor: "rgba(251, 191, 36, 0.98)",
    borderBottomColor: "rgba(56, 189, 248, 0.72)"
  },
  ringMiddle: {
    width: "41%",
    height: "41%",
    borderWidth: 2,
    borderColor: "rgba(56, 189, 248, 0.22)",
    borderLeftColor: "rgba(56, 189, 248, 0.98)",
    borderRightColor: "rgba(251, 191, 36, 0.62)"
  },
  ringInner: {
    width: "23%",
    height: "23%",
    borderWidth: 1,
    borderColor: "rgba(248, 250, 252, 0.14)",
    borderTopColor: "rgba(248, 250, 252, 0.75)"
  },
  coreWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  coreGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.18)",
    shadowColor: "#fbbf24",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 }
  },
  core: {
    width: 68,
    height: 68,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.72)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    alignItems: "center",
    justifyContent: "center"
  },
  sigilInner: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.7)",
    backgroundColor: "rgba(56, 189, 248, 0.12)"
  },
  orbit: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.1)",
    borderRadius: 999,
    alignItems: "center"
  },
  orbitA: {
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -100
  },
  orbitB: {
    width: 228,
    height: 228,
    marginLeft: -114,
    marginTop: -114
  },
  orbitC: {
    width: 252,
    height: 252,
    marginLeft: -126,
    marginTop: -126
  },
  orbitDot: {
    position: "absolute",
    top: -3,
    left: "50%",
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    shadowColor: "#f8fafc",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }
  },
  orbitDotA: {
    backgroundColor: "#38bdf8"
  },
  orbitDotB: {
    width: 5,
    height: 5,
    top: -2.5,
    marginLeft: -2.5,
    backgroundColor: "#fbbf24"
  },
  orbitDotC: {
    width: 4,
    height: 4,
    top: -2,
    marginLeft: -2,
    backgroundColor: "rgba(251, 191, 36, 0.7)"
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5
  },
  caption: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  }
});