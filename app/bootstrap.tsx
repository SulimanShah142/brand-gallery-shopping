import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="bootstrap" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(shop)" />
    </Stack>
  );
}