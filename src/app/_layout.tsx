import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ListenerProvider } from '@/components/listener-provider';
import { MiniPlayer } from '@/components/mini-player';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head><title>Torat Tsion | Torah listening</title><meta name="description" content="Listen to shiurim and Torah recordings from Torat Tsion." /></Head>
      <ListenerProvider>
        <AnimatedSplashOverlay />
        {Platform.OS !== 'web' ? <AppTabs /> : <Stack screenOptions={{ headerShown: false }} />}
        <MiniPlayer />
      </ListenerProvider>
    </ThemeProvider>
  );
}
