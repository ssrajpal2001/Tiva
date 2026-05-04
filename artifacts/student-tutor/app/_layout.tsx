import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ProgressProvider } from "@/contexts/ProgressContext";
import { CoinsProvider } from "@/contexts/CoinsContext";

if (process.env.EXPO_PUBLIC_API_URL) {
  setBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[sessionId]" options={{ headerShown: false }} />
      <Stack.Screen name="call/[sessionId]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="test/[testId]" options={{ headerShown: false }} />
      <Stack.Screen name="test/results/[testId]" options={{ headerShown: false }} />
      <Stack.Screen name="store" options={{ headerShown: false }} />
      <Stack.Screen name="textbooks" options={{ headerShown: false }} />
      <Stack.Screen name="prev-year-papers" options={{ headerShown: false }} />
      <Stack.Screen name="teacher-portal" options={{ headerShown: false }} />
      <Stack.Screen name="referral" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ProfileProvider>
                <ProgressProvider>
                  <CoinsProvider>
                    <RootLayoutNav />
                  </CoinsProvider>
                </ProgressProvider>
              </ProfileProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
    </ThemeProvider>
  );
}
