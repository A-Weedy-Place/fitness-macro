import { File, Paths } from 'expo-file-system';

export type AppThemeName = 'warm' | 'neutral' | 'charcoal';

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

export const themeOptions: Array<{ key: AppThemeName; label: string; detail: string }> = [
  { key: 'warm', label: 'Warm Harvest', detail: 'The original cream, forest, coral, and gold palette.' },
  { key: 'neutral', label: 'Clean Neutral', detail: 'The current crisp white and graphite palette.' },
  { key: 'charcoal', label: 'Charcoal', detail: 'A low-glare dark palette with the same macro colors.' }
];

const themeFile = new File(Paths.document, 'fitness-theme.txt');

function readTheme(): AppThemeName {
  try {
    const value = themeFile.exists ? themeFile.textSync().trim() : '';
    return value === 'neutral' || value === 'charcoal' || value === 'warm' ? value : 'warm';
  } catch {
    return 'warm';
  }
}

export const activeTheme = readTheme();
export const colors = activeTheme === 'neutral' ? neutral : activeTheme === 'charcoal' ? charcoal : warm;
export const isDarkTheme = activeTheme === 'charcoal';
export const atmosphere = activeTheme === 'charcoal'
  ? { one: '#26372E', two: '#40261F' }
  : activeTheme === 'neutral' ? { one: '#F4DCCB', two: '#D7E6DD' } : { one: '#EBC7AE', two: '#BFD8C8' };

export function saveAppTheme(theme: AppThemeName): void {
  if (!themeFile.exists) themeFile.create({ intermediates: true });
  themeFile.write(theme);
}

export const radii = { small: 10, medium: 16, large: 24, pill: 999 } as const;
export const shadows = { card: { shadowColor: isDarkTheme ? '#000000' : '#3B3120', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDarkTheme ? 0.2 : 0.08, shadowRadius: 18, elevation: 3 } } as const;
