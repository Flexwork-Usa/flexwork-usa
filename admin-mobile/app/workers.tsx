import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { requireAdminUser, signOutAdmin, supabase } from "../src/lib/supabase";

type Worker = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  country: string | null;
  token_balance: number | null;
  wallet_usdt_tron: string | null;
  wallet_usdt_eth: string | null;
  wallet_usdc_eth: string | null;
  is_approved: boolean | null;
};

export default function WorkerInspectorScreen() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selected, setSelected] = useState<Worker | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const admin = await requireAdminUser();
        if (!admin.user) {
          router.replace("/");
          return;
        }
        const { data, error: queryError } = await supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone_number, country, token_balance, wallet_usdt_tron, wallet_usdt_eth, wallet_usdc_eth, is_approved",
          )
          .eq("role", "worker")
          .order("full_name", { ascending: true });
        if (!active) return;
        if (queryError) setError(queryError.message);
        else setWorkers((data ?? []) as Worker[]);
      })();
      return () => {
        active = false;
      };
    }, [router]),
  );

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.push("/approvals")}>
          <Text style={styles.link}>Task & deposit approvals</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await signOutAdmin();
            router.replace("/");
          }}
        >
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {workers.map((worker) => (
        <Pressable
          key={worker.id}
          style={styles.card}
          onPress={() => setSelected(worker.id === selected?.id ? null : worker)}
        >
          <Text style={styles.name}>{worker.full_name || "Worker"}</Text>
          <Text style={styles.meta}>{worker.email}</Text>
          <Text style={styles.meta}>
            {worker.token_balance ?? 0} tokens · {worker.is_approved ? "Approved" : "Pending"}
          </Text>
          {selected?.id === worker.id ? (
            <View style={styles.detail}>
              <Text style={styles.meta}>Phone: {worker.phone_number || "—"}</Text>
              <Text style={styles.meta}>Country: {worker.country || "—"}</Text>
              <Text style={styles.meta}>USDT TRC-20: {worker.wallet_usdt_tron || "Pending assignment"}</Text>
              <Text style={styles.meta}>USDT ERC-20: {worker.wallet_usdt_eth || "Pending assignment"}</Text>
              <Text style={styles.meta}>USDC ERC-20: {worker.wallet_usdc_eth || "Pending assignment"}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
      {workers.length === 0 && !error ? <Text style={styles.meta}>No worker profiles are visible.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  link: { color: "#C85A17", fontWeight: "600" },
  signOut: { color: "#475569", fontWeight: "600" },
  card: { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 14 },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  meta: { marginTop: 4, color: "#475569" },
  detail: { marginTop: 8 },
  error: { color: "#b91c1c" },
});
