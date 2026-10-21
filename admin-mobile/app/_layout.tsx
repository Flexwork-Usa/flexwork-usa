import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#111827",
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: "#f8fafc" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Admin login", headerShown: false }} />
        <Stack.Screen name="workers" options={{ title: "Worker inspector" }} />
        <Stack.Screen name="approvals" options={{ title: "Task & deposit approvals" }} />
      </Stack>
    </>
  );
}
