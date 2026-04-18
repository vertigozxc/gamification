import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

function Tower({ height, width, style }) {
  return <View style={[styles.tower, { height, width }, style]} />;
}

export default function PortalPreloader({ title = "Initializing world...", caption = "" }) {
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
        <View style={styles.beam} />
        <View style={styles.cityline}>
          <Tower height={42} width={18} />
          <Tower height={58} width={22} style={{ marginLeft: 6 }} />
          <Tower height={34} width={14} style={{ marginLeft: 7 }} />
          <Tower height={72} width={26} style={{ marginLeft: 8 }} />
          <Tower height={48} width={16} style={{ marginLeft: 8 }} />
          <Tower height={56} width={20} style={{ marginLeft: 7 }} />
        </View>

        <View style={styles.platform} />

        <Animated.View style={[styles.ring, styles.ringOuter, { transform: [{ translateX: -34 }, { translateY: -28 }, { rotate: outerSpin }] }]} />
        <Animated.View style={[styles.ring, styles.ringMiddle, { transform: [{ translateX: -18 }, { translateY: -8 }, { rotate: middleSpin }] }]} />
        <Animated.View style={[styles.ring, styles.ringInner, { transform: [{ rotate: innerSpin }] }]} />

        <Animated.View style={[styles.coreWrap, { transform: [{ scale: pulse }] }]}>
          <View style={styles.coreGlow} />
          <View style={styles.core}>
            <View style={styles.sigilInner} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.particle, styles.particleA, { transform: [{ rotate: orbitASpin }] }]}><View style={[styles.particleDot, styles.particleDotA]} /></Animated.View>
        <Animated.View style={[styles.particle, styles.particleB, { transform: [{ rotate: orbitBSpin }] }]}><View style={[styles.particleDot, styles.particleDotB]} /></Animated.View>
        <Animated.View style={[styles.particle, styles.particleC, { transform: [{ rotate: orbitCSpin }] }]}><View style={[styles.particleDot, styles.particleDotC]} /></Animated.View>
        <View style={styles.speck} />
        <View style={[styles.speck, styles.speckBlue]} />
        <View style={[styles.speck, styles.speckWhite]} />
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
    width: 280,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18
  },
  aurora: {
    position: "absolute",
    width: 146,
    height: 146,
    borderRadius: 999,
    opacity: 0.32
  },
  auroraLeft: {
    left: 48,
    top: 76,
    backgroundColor: "rgba(56, 189, 248, 0.18)"
  },
  auroraRight: {
    right: 26,
    top: 88,
    backgroundColor: "rgba(251, 191, 36, 0.14)"
  },
  beam: {
    position: "absolute",
    width: 86,
    height: 156,
    top: 54,
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.10)",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 }
  },
  cityline: {
    position: "absolute",
    bottom: 38,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    opacity: 0.84
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
    bottom: 22,
    width: 142,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.22)"
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderStyle: "solid"
  },
  ringOuter: {
    width: 208,
    height: 208,
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.35)",
    borderTopColor: "rgba(251, 191, 36, 0.96)",
    borderBottomColor: "rgba(56, 189, 248, 0.18)"
  },
  ringMiddle: {
    width: 172,
    height: 172,
    borderWidth: 2,
    borderColor: "rgba(56, 189, 248, 0.28)",
    borderLeftColor: "rgba(56, 189, 248, 0.98)",
    borderRightColor: "rgba(56, 189, 248, 0.18)"
  },
  ringInner: {
    width: 112,
    height: 112,
    borderWidth: 1,
    borderColor: "rgba(248, 250, 252, 0.18)",
    borderTopColor: "rgba(248, 250, 252, 0.28)"
  },
  coreWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  coreGlow: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.16)",
    shadowColor: "#f8fafc",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }
  },
  core: {
    width: 50,
    height: 50,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.72)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    alignItems: "center",
    justifyContent: "center"
  },
  sigilInner: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(248, 250, 252, 0.88)",
    transform: [{ rotate: "45deg" }]
  },
  particle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    alignItems: "center",
    justifyContent: "flex-start"
  },
  particleA: {
    width: 188,
    height: 188,
    marginLeft: -30,
    marginTop: -86
  },
  particleB: {
    width: 230,
    height: 230,
    marginLeft: -4,
    marginTop: -86
  },
  particleC: {
    width: 138,
    height: 138,
    marginLeft: -68,
    marginTop: -30
  },
  particleDot: {
    position: "absolute",
    top: 0,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    shadowColor: "#f8fafc",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 }
  },
  particleDotA: {
    backgroundColor: "#38bdf8"
  },
  particleDotB: {
    width: 5,
    height: 5,
    top: 2,
    backgroundColor: "#fbbf24"
  },
  particleDotC: {
    width: 4,
    height: 4,
    top: 6,
    backgroundColor: "rgba(248, 250, 252, 0.85)"
  },
  speck: {
    position: "absolute",
    right: 38,
    top: 116,
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.5)"
  },
  speckBlue: {
    left: 74,
    top: 116,
    backgroundColor: "rgba(56, 189, 248, 0.45)"
  },
  speckWhite: {
    left: 134,
    top: 96,
    backgroundColor: "rgba(248, 250, 252, 0.4)"
  },
  title: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 2.4,
    textTransform: "uppercase"
  },
  caption: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20
  }
});