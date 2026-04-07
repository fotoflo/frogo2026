import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#ededed",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#0a0a0a" },
        }}
      />
    </>
  );
}
