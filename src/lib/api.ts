const productionApiUrl = 'https://torat-tsion-api.onrender.com';

export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || productionApiUrl).replace(/\/$/, '');
export const apiUrl = (path: string) => `${apiBaseUrl}${path}`;