import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';

export type AppThemeName = 'warm' | 'neutral' | 'charcoal' | 'ocean' | 'orchid';

interface ThemeColors {
  paper: string; paperDeep: string; card: string; ink: string; muted: string; faint: string; line: string;
  pine: string; pineSoft: string; coral: string; coralSoft: string; gold: string; goldSoft: string;
  sky: string; danger: string; white: string;
}

const warm: ThemeColors = {
  paper: '#F7F1E7', paperDeep: '#EDE1D0', card: '#FFFDF8', ink: '#1D2C25', muted: '#6F746A', faint: '#9A9C90', line: '#DED3C2',
  pine: '#173F2D', pineSoft: '#DFECE3', coral: '#E66B50', coralSoft: '#FAE2D9', gold: '#D8A43A', goldSoft: '#FAF0CF', sky: '#527FA4', danger: '#A64035', white: '#FFFFFF'
};

const neutral: ThemeColors = {
  paper: '#F5F6F4', paperDeep: '#E9EBE8', card: '#FFFFFF', ink: '#111412', muted: '#6B706C', faint: '#A3A7A3', line: '#E2E5E1',
  pine: '#151917', pineSoft: '#ECEFEC', coral: '#FF7357', coralSoft: '#FFF0EC', gold: '#F2B934', goldSoft: '#FFF7DB', sky: '#4C91FF', danger: '#A83F32', white: '#FFFFFF'
};

const charcoal: ThemeColors = {
  paper: '#111412', paperDeep: '#202521', card: '#191D1A', ink: '#F4F1E9', muted: '#A7A9A3', faint: '#777D77', line: '#303631',
  pine: '#0B0E0C', pineSoft: '#26372E', coral: '#FF8065', coralSoft: '#40261F', gold: '#F0BF4B', goldSoft: '#3A321E', sky: '#69A5FF', danger: '#FF8A78', white: '#FFFFFF'
};

const ocean: ThemeColors = {
  paper: '#EEF6F8', paperDeep: '#DCECEF', card: '#FCFEFF', ink: '#14323B', muted: '#63777B', faint: '#96A9AD', line: '#CBDDE1',
  pine: '#0D4B5C', pineSoft: '#D9EDF1', coral: '#D96852', coralSoft: '#FAE4DF', gold: '#D9A437', goldSoft: '#FCF1D2', sky: '#317AA0', danger: '#B04B3C', white: '#FFFFFF'
};

const orchid: ThemeColors = {
  paper: '#F8F2F8', paperDeep: '#EEE0ED', card: '#FFFDFE', ink: '#302136', muted: '#796A7B', faint: '#A796A9', line: '#E2D4E2',
  pine: '#4A2D59', pineSoft: '#EEE1F1', coral: '#C95D76', coralSoft: '#F9E0E7', gold: '#C89338', goldSoft: '#FBF0D4', sky: '#596EAE', danger: '#A8425C', white: '#FFFFFF'
};

export const themeOptions: Array<{ key: AppThemeName; label: string; detail: string }> = [
  { key: 'warm', label: 'Warm Harvest', detail: 'The original cream, forest, coral, and gold palette.' },
  { key: 'neutral', label: 'Clean Neutral', detail: 'The current crisp white and graphite palette.' },
  { key: 'charcoal', label: 'Charcoal', detail: 'A low-glare dark palette with the same macro colors.' },
  { key: 'ocean', label: 'Coastal Blue', detail: 'A cool sea-glass palette with strong contrast.' },
  { key: 'orchid', label: 'Orchid Dusk', detail: 'A soft violet palette with warm coral actions.' }
];

const themeFile = new File(Paths.document, 'fitness-theme.txt');
const themeReturnFile = new File(Paths.document, 'fitness-theme-return.txt');

function readTheme(): AppThemeName {
  try {
    const value = themeFile.exists ? themeFile.textSync().trim() : '';
    return value === 'neutral' || value === 'charcoal' || value === 'warm' || value === 'ocean' || value === 'orchid' ? value : 'warm';
  } catch {
    return 'warm';
  }
}

export let activeTheme = readTheme();
const palettes = { warm, neutral, charcoal, ocean, orchid };
export let colors = palettes[activeTheme];
export let isDarkTheme = activeTheme === 'charcoal';
function themeAtmosphere() { return activeTheme === 'charcoal'
  ? { one: '#26372E', two: '#40261F' }
  : activeTheme === 'neutral' ? { one: '#F4DCCB', two: '#D7E6DD' }
    : activeTheme === 'ocean' ? { one: '#C8E8ED', two: '#D8E8F5' }
      : activeTheme === 'orchid' ? { one: '#EAD7EA', two: '#E9D9C7' } : { one: '#EBC7AE', two: '#BFD8C8' }; }
export let atmosphere = themeAtmosphere();
const listeners = new Set<() => void>();
export function useAppTheme(): AppThemeName {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => activeTheme, () => 'warm');
}

/** Re-evaluate static-style factories on palette changes without remounting screens. */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): T {
  let name: AppThemeName | undefined;
  let cached: T;
  return new Proxy({} as T, { get(_target, property) {
    if (name !== activeTheme) { cached = StyleSheet.create(factory()); name = activeTheme; }
    return Reflect.get(cached, property);
  } });
}

export function saveAppTheme(theme: AppThemeName): void {
  if (!themeFile.exists) themeFile.create({ intermediates: true });
  themeFile.write(theme);
  activeTheme = theme;
  colors = palettes[theme];
  isDarkTheme = theme === 'charcoal';
  atmosphere = themeAtmosphere();
  listeners.forEach((listener) => listener());
}

/** The palette is read while static React Native styles initialise. Store the
 * desired return location before a safe reload so changing a palette never
 * strands the owner back on Today. */
export function saveThemeAppearanceReturn(): void {
  try {
    if (!themeReturnFile.exists) themeReturnFile.create({ intermediates: true });
    themeReturnFile.write('appearance');
  } catch {
    // Theme choice remains valid even if the optional return hint cannot save.
  }
}

export function consumeThemeAppearanceReturn(): boolean {
  try {
    const shouldReturn = themeReturnFile.exists && themeReturnFile.textSync().trim() === 'appearance';
    if (themeReturnFile.exists) themeReturnFile.delete();
    return shouldReturn;
  } catch {
    return false;
  }
}

export const radii = { small: 10, medium: 16, large: 24, pill: 999 } as const;
export const shadows = { get card() { return { shadowColor: isDarkTheme ? '#000000' : '#3B3120', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDarkTheme ? 0.2 : 0.08, shadowRadius: 18, elevation: 3 } as const; } };
