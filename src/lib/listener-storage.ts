import AsyncStorage from '@react-native-async-storage/async-storage';

export const listenerStorageKeys = {
  favorites: '@torat-tsion/favorites',
  positions: '@torat-tsion/positions',
  playlists: '@torat-tsion/playlists',
  recent: '@torat-tsion/recent',
  playbackRate: '@torat-tsion/playback-rate',
};

export async function readStored<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeStored<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local preferences should never interrupt playback.
  }
}
