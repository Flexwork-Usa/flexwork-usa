import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { requireAdminUser, signOutAdmin, supabase } from "../src/lib/supabase";

type Deposit = {
  id: string;
  user_id: string | null;
  amount_usd: number | string;
  tokens_to_credit: number;
  wallet_type: string;
  transaction_hash: string;
  status: string;
};

type Task = {
  id: string;
  user_id: string;
  status: string;
  tokens_spent: number | null;
  jobs: { title: string | null } | { title: string | null }[] | null;
};

export default function ApprovalsScreen() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const admin = await requireAdminUser();
    if (!admin.user) {
      router.replace("/");
      return;
    }
    const [depositResult, taskResult] = await Promise.all([
      supabase
        .from("wallet_deposits")
        .select("id, user_id, amount_usd, tokens_to_credit, wallet_type, transaction_hash, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("job_applications")
        .select("id, user_id, status, tokens_spent, jobs(title)")
        .in("status", ["applied", "pending", "reviewing"])
        .order("created_at", { ascending: false }),
    ]);
    if (depositResult.error) setError(depositResult.error.message);
    else setDeposits((depositResult.data ?? []) as Deposit[]);
    if (taskResult.error) setError(taskResult.error.message);
    else setTasks((taskResult.data ?? []) as Task[]);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function reviewDeposit(deposit: Deposit, status: "approved" | "rejected") {
    setNotice(null);
    setError(null);
    setBusyId(deposit.id);
    const { error: updateError } = await supabase
      .from("wallet_deposits")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", deposit.id)
      .eq("status", "pending");
    if (updateError) {
      setBusyId(null);
      setError(updateError.message);
      return;
    }
    if (status === "approved" && deposit.user_id) {
      const { data: profile } = await supabase.from("profiles").select("token_balance").eq("id", deposit.user_id).maybeSingle();
      const nextBalance = (profile?.token_balance ?? 0) + deposit.tokens_to_credit;
      const { error: creditError } = await supabase.from("profiles").update({ token_balance: nextBalance }).eq("id", deposit.user_id);
      if (creditError) {
        setBusyId(null);
        setError(creditError.message);
        return;
      }
    }
    setBusyId(null);
    setNotice(status === "approved" ? "Deposit approved and tokens credited." : "Deposit rejected.");
    await load();
  }

  async function reviewTask(task: Task, status: "accepted" | "rejected") {
    setNotice(null);
    setError(null);
    setBusyId(task.id);
    const { error: updateError } = await supabase.from("job_applications").update({ status }).eq("id", task.id);
    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotice(status === "accepted" ? "Task approved." : "Task rejected.");
    await load();
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.push("/workers")}>
          <Text style={styles.link}>Worker inspector</Text>
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
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Text style={styles.heading}>USDT deposits</Text>
      {deposits.length === 0 ? <Text style={styles.meta}>No pending deposits.</Text> : null}
      {deposits.map((deposit) => (
        <View key={deposit.id} style={styles.card}>
          <Text style={styles.name}>{deposit.wallet_type}</Text>
          <Text style={styles.meta}>
            ${Number(deposit.amount_usd).toFixed(2)} · {deposit.tokens_to_credit} tokens
          </Text>
          <Text style={styles.meta}>{deposit.transaction_hash}</Text>
          <View style={styles.row}>
            <Pressable style={styles.approve} disabled={busyId === deposit.id} onPress={() => void reviewDeposit(deposit, "approved")}>
              <Text style={styles.buttonText}>{busyId === deposit.id ? "…" : "Approve"}</Text>
            </Pressable>
            <Pressable style={styles.reject} disabled={busyId === deposit.id} onPress={() => void reviewDeposit(deposit, "rejected")}>
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Text style={styles.heading}>Submitted tasks</Text>
      {tasks.length === 0 ? <Text style={styles.meta}>No tasks waiting for review.</Text> : null}
      {tasks.map((task) => {
        const job = Array.isArray(task.jobs) ? task.jobs[0] : task.jobs;
        return (
          <View key={task.id} style={styles.card}>
            <Text style={styles.name}>{job?.title || "Task"}</Text>
            <Text style={styles.meta}>
              {task.status} · {task.tokens_spent ?? 0} tokens
            </Text>
            <View style={styles.row}>
              <Pressable style={styles.approve} disabled={busyId === task.id} onPress={() => void reviewTask(task, "accepted")}>
                <Text style={styles.buttonText}>{busyId === task.id ? "…" : "Approve"}</Text>
              </Pressable>
              <Pressable style={styles.reject} disabled={busyId === task.id} onPress={() => void reviewTask(task, "rejected")}>
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12 },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { color: "#C85A17", fontWeight: "600" },
  signOut: { color: "#475569", fontWeight: "600" },
  heading: { marginTop: 8, fontSize: 18, fontWeight: "600", color: "#0f172a" },
  card: { backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 14 },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  meta: { marginTop: 4, color: "#475569" },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  approve: { backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  reject: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { color: "#ffffff", fontWeight: "600" },
  rejectText: { color: "#0f172a", fontWeight: "600" },
  error: { color: "#b91c1c" },
  notice: { color: "#166534" },
});
