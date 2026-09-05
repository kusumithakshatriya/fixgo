/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#152326',
    background: '#F7F9F9',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E2F7F9',
    textSecondary: '#68777A',
  },
  dark: {
    text: '#F7F9F9',
    background: '#123A40',
    backgroundElement: '#143E44',
    backgroundSelected: '#1B555B',
    textSecondary: '#B4C7C9',
  },
} as const;

export const FixGoColors = { primary: '#123A40', primaryElevated: '#143E44', accent: '#64D9E5', background: '#F7F9F9', card: '#FFFFFF', text: '#152326', textSecondary: '#68777A', success: '#2E9B72', border: '#E4ECEC', accentSurface: '#E2F7F9', shadow: '#152326' } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { small: 12, medium: 16, large: 20, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
