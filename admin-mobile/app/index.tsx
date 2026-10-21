import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { requireAdminUser, supabase } from "../src/lib/supabase";

export default function AdminLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn() {
    setSubmitting(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError || !data.user) {
      setError("Unable to authenticate.");
      setSubmitting(false);
      return;
    }
    const admin = await requireAdminUser();
    setSubmitting(false);
    if (!admin.user) {
      setError(admin.error);
      return;
    }
    router.replace("/workers");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>flexwork-usa</Text>
      <Text style={styles.heading}>Admin login</Text>
      <Text style={styles.copy}>Only accounts listed in admin_users can open this console.</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        secureTextEntry
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} disabled={submitting} onPress={() => void signIn()}>
        <Text style={styles.buttonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f8fafc" },
  brand: { fontSize: 13, fontWeight: "600", color: "#C85A17", marginBottom: 8 },
  heading: { fontSize: 24, fontWeight: "600", color: "#0f172a" },
  copy: { marginTop: 8, marginBottom: 20, color: "#475569" },
  input: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#0f172a",
  },
  button: { marginTop: 8, borderRadius: 10, backgroundColor: "#111827", paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "600" },
  error: { color: "#b91c1c", marginBottom: 8 },
});
