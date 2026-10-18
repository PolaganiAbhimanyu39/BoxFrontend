import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FAF5" />

      <View style={styles.hero}>
        <Text style={styles.cricketIcon}>🏏</Text>
        <Text style={styles.ball}>🔴</Text>
        <Text style={styles.heroText}>YOUR GAME. YOUR TURF.</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.welcome}>Welcome to</Text>
        <Text style={styles.title}>Box Cricket</Text>

        <Text style={styles.description}>
          Find the best box cricket turfs near you, compare prices, and book
          your next game with ease.
        </Text>

        <View style={styles.dots}>
          <View style={styles.activeDot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => console.log("Get started")}
        >
          <Text style={styles.primaryText}>Get Started →</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => console.log("Login")}
        >
          <Text style={styles.secondaryText}>I Already Have an Account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAF5",
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 30,
  },
  hero: {
    height: "38%",
    backgroundColor: "#DDF4E7",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cricketIcon: {
    fontSize: 105,
  },
  ball: {
    position: "absolute",
    top: 25,
    right: 30,
    fontSize: 28,
  },
  heroText: {
    color: "#137A4C",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  welcome: {
    fontSize: 34,
    fontWeight: "800",
    color: "#168354",
  },
  title: {
    fontSize: 38,
    fontWeight: "900",
    color: "#14252D",
    marginTop: 2,
  },
  description: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 25,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  dots: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },
  activeDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#168354",
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#C8D8D0",
  },
  actions: {
    gap: 14,
  },
  primaryButton: {
    backgroundColor: "#168354",
    paddingVertical: 19,
    borderRadius: 35,
    alignItems: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#168354",
    paddingVertical: 17,
    borderRadius: 35,
    alignItems: "center",
  },
  secondaryText: {
    color: "#168354",
    fontSize: 15,
    fontWeight: "700",
  },
});
