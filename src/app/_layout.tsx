import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ListenerProvider } from '@/components/listener-provider';
import { MiniPlayer } from '@/components/mini-player';
import { YouTubePlaybackProvider } from '@/components/video-showcase';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head><title>Torah Farsi | A project of Torat Sion</title><meta name="description" content="Explore Torah shiurim in Farsi with Torah Farsi, a project of Torat Sion. Browse classes by topic and learn with Rabbi Bakhshi." /></Head>
      <ListenerProvider>
        <YouTubePlaybackProvider>
        <AnimatedSplashOverlay />
        {Platform.OS !== 'web' ? <AppTabs /> : <Stack screenOptions={{ headerShown: false }} />}
        <MiniPlayer />
        </YouTubePlaybackProvider>
      </ListenerProvider>
    </ThemeProvider>
  );
}
