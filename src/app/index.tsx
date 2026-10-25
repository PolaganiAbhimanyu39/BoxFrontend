import { AuthColors } from '@/constants/auth-colors';
import { useSession } from "@/context/session";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { API_URL } from '@/services/api';
import CreateUser from '@/features/users/components/create-user';

export default function LoginScreen() {
  const { signIn } = useSession();

  const [email, setEmail] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (loading) return;

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ??
            (response.status === 401
              ? "Invalid email or password."
              : "Unable to sign in. Please try again."),
        );
      }

      if (typeof data?.token !== "string" || typeof data.expiresIn !== "number") {
        throw new Error("Invalid login response");
      }

      signIn(data.token, data.expiresIn, data.user);
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>A</Text>
          </View>

          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to continue to your account.
          </Text>

          {signupSuccess ? <Text accessibilityRole="alert" style={styles.signupSuccess}>{signupSuccess}</Text> : null}
          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={AuthColors.muted}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={AuthColors.muted}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setError("");
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!loading}
              />

              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                disabled={loading}
                accessibilityRole="button"
              >
                <Text style={styles.link}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View
                style={styles.errorBox}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={AuthColors.surface} />
              ) : (
                <Text style={styles.loginButtonText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={() => { setError(''); setSigningUp(true); }} style={styles.signupButton}><Text style={styles.link}>New player? Sign up</Text></Pressable>
          <Text style={styles.footer}>
            Securely sign in to access your account.
          </Text>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={signingUp} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!signupBusy) setSigningUp(false); }}>
        {signingUp ? <CreateUser mode="signup" onBusyChange={setSignupBusy} onClose={() => setSigningUp(false)} onCreated={user => { setSigningUp(false); setEmail(user.email || ''); setPassword(''); setSignupSuccess('Your player account is ready. Sign in to continue.'); }} /> : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  signupButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  signupSuccess: { color: AuthColors.success, backgroundColor: AuthColors.successBackground, padding: 14, borderRadius: 12, marginTop: 16, lineHeight: 22 },
  safeArea: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: AuthColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  logoText: {
    color: AuthColors.surface,
    fontSize: 28,
    fontWeight: "700",
  },
  heading: {
    fontSize: 32,
    fontWeight: "700",
    color: AuthColors.heading,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 15,
    color: AuthColors.muted,
    marginTop: 10,
    lineHeight: 23,
  },
  form: {
    marginTop: 36,
  },
  label: {
    color: AuthColors.label,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 9,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: AuthColors.text,
    backgroundColor: AuthColors.surface,
    marginBottom: 24,
  },
  passwordContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 10,
    backgroundColor: AuthColors.surface,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: AuthColors.text,
  },
  link: {
    color: AuthColors.link,
    fontSize: 14,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: AuthColors.errorBackground,
    borderWidth: 1,
    borderColor: AuthColors.errorBorder,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: AuthColors.error,
    fontSize: 14,
  },
  loginButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: AuthColors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  loginButtonText: {
    color: AuthColors.surface,
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    color: AuthColors.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 32,
  },
});
