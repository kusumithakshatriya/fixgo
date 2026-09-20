export const appConfig = {
  appName: 'FixGo',
  tagline: 'Your problem. Our solution.',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
} as const;
