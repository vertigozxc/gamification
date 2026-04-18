import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

function Tower({ height, width, style }) {
  return <View style={[styles.tower, { height, width }, style]} />;
}

export default function PortalPreloader({ title = "Summoning Portal...", caption = "" }) {
  const pulse = useRef(new Animated.Value(0.92)).current;
  const rotateOuter = useRef(new Animated.Value(0)).current;
  const rotateInner = useRef(new Animated.Value(0)).current;
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;
  const floatC = useRef(new Animated.Value(0)).current;

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

    const innerLoop = Animated.loop(
      Animated.timing(rotateInner, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    const createFloatLoop = (value, duration) => Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );

    const floatLoopA = createFloatLoop(floatA, 1900);
    const floatLoopB = createFloatLoop(floatB, 2300);
    const floatLoopC = createFloatLoop(floatC, 1700);

    pulseLoop.start();
    outerLoop.start();
    innerLoop.start();
    floatLoopA.start();
    floatLoopB.start();
    floatLoopC.start();

    return () => {
      pulseLoop.stop();
      outerLoop.stop();
      innerLoop.stop();
      floatLoopA.stop();
      floatLoopB.stop();
      floatLoopC.stop();
      pulse.stopAnimation();
      rotateOuter.stopAnimation();
      rotateInner.stopAnimation();
      floatA.stopAnimation();
      floatB.stopAnimation();
      floatC.stopAnimation();
    };
  }, [floatA, floatB, floatC, pulse, rotateInner, rotateOuter]);

  const outerSpin = rotateOuter.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });
  const innerSpin = rotateInner.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"]
  });

  const floatTransform = (value, x, y) => ({
    transform: [
      { translateX: x },
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, y]
        })
      },
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1.08]
        })
      }
    ],
    opacity: value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.45, 1]
    })
  });

  return (
    <View style={styles.container}>
      <View style={styles.scene}>
        <View style={[styles.aurora, styles.auroraLeft]} />
        <View style={[styles.aurora, styles.auroraRight]} />
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
        <Animated.View style={[styles.ring, styles.ringInner, { transform: [{ rotate: innerSpin }] }]} />

        <Animated.View style={[styles.coreWrap, { transform: [{ scale: pulse }] }]}>
          <View style={styles.coreGlow} />
          <View style={styles.core}>
            <View style={styles.sigilVertical} />
            <View style={styles.sigilHorizontal} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.spark, styles.sparkA, floatTransform(floatA, -78, -14)]} />
        <Animated.View style={[styles.spark, styles.sparkB, floatTransform(floatB, 88, -20)]} />
        <Animated.View style={[styles.spark, styles.sparkC, floatTransform(floatC, 0, -28)]} />
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
    marginBottom: 22
  },
  aurora: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    opacity: 0.25
  },
  auroraLeft: {
    left: 18,
    top: 26,
    backgroundColor: "rgba(56, 189, 248, 0.18)"
  },
  auroraRight: {
    right: 18,
    top: 8,
    backgroundColor: "rgba(251, 191, 36, 0.16)"
  },
  cityline: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    opacity: 0.9
  },
  tower: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.18)",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10
  },
  platform: {
    position: "absolute",
    bottom: 34,
    width: 172,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.24)"
  },
  beam: {
    position: "absolute",
    width: 86,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.09)",
    shadowColor: "#38bdf8",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderStyle: "solid"
  },
  ringOuter: {
    width: 178,
    height: 178,
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.45)",
    borderTopColor: "rgba(251, 191, 36, 0.95)",
    borderBottomColor: "rgba(56, 189, 248, 0.55)"
  },
  ringInner: {
    width: 122,
    height: 122,
    borderWidth: 2,
    borderColor: "rgba(56, 189, 248, 0.34)",
    borderLeftColor: "rgba(56, 189, 248, 0.9)",
    borderRightColor: "rgba(251, 191, 36, 0.7)"
  },
  coreWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  coreGlow: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    shadowColor: "#fbbf24",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }
  },
  core: {
    width: 66,
    height: 66,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(251, 191, 36, 0.78)",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    alignItems: "center",
    justifyContent: "center"
  },
  sigilVertical: {
    position: "absolute",
    width: 2,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#f8fafc"
  },
  sigilHorizontal: {
    position: "absolute",
    width: 28,
    height: 2,
    borderRadius: 999,
    backgroundColor: "#f8fafc"
  },
  spark: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    shadowColor: "#f8fafc",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }
  },
  sparkA: {
    left: "50%",
    top: 96,
    marginLeft: -5,
    backgroundColor: "#38bdf8"
  },
  sparkB: {
    left: "50%",
    top: 106,
    marginLeft: -5,
    backgroundColor: "#fbbf24"
  },
  sparkC: {
    left: "50%",
    top: 80,
    marginLeft: -5
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