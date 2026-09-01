import { File, Paths } from 'expo-file-system';

export type AppThemeName = 'warm' | 'neutral' | 'charcoal' | 'ocean' | 'orchid';

interface ThemeColors {
  paper: string; paperDeep: string; card: string; ink: string; muted: string; faint: string; line: string;
  pine: string; pineSoft: string; coral: string; coralSoft: string; gold: string; goldSoft: string;
  sky: string; danger: string; white: string;
}

const warm: ThemeColors = {
  paper: '#F8F8F5', paperDeep: '#EFF0EC', card: '#FFFFFF', ink: '#233029', muted: '#68726B', faint: '#9BA39D', line: '#DFE3DE',
  pine: '#31483C', pineSoft: '#EEF1ED', coral: '#31483C', coralSoft: '#F1F3F0', gold: '#31483C', goldSoft: '#F1F3F0', sky: '#31483C', danger: '#A64035', white: '#FFFFFF'
};

const neutral: ThemeColors = {
  paper: '#F7F8F6', paperDeep: '#EEF0ED', card: '#FFFFFF', ink: '#202622', muted: '#6C736E', faint: '#A1A8A2', line: '#E0E4E0',
  pine: '#3F4A43', pineSoft: '#EFF1EF', coral: '#3F4A43', coralSoft: '#F1F3F1', gold: '#3F4A43', goldSoft: '#F1F3F1', sky: '#3F4A43', danger: '#A83F32', white: '#FFFFFF'
};

const charcoal: ThemeColors = {
  paper: '#202522', paperDeep: '#2A302C', card: '#272D29', ink: '#F3F5F1', muted: '#B1B8B2', faint: '#858E87', line: '#39413B',
  pine: '#607467', pineSoft: '#303832', coral: '#607467', coralSoft: '#303832', gold: '#607467', goldSoft: '#303832', sky: '#607467', danger: '#FF8A78', white: '#FFFFFF'
};

const ocean: ThemeColors = {
  paper: '#F2F7F7', paperDeep: '#E8EFEF', card: '#FCFEFE', ink: '#26383A', muted: '#65787A', faint: '#9CACAD', line: '#D9E3E3',
  pine: '#3D6265', pineSoft: '#EBF0F0', coral: '#3D6265', coralSoft: '#EDF2F2', gold: '#3D6265', goldSoft: '#EDF2F2', sky: '#3D6265', danger: '#B04B3C', white: '#FFFFFF'
};

const orchid: ThemeColors = {
  paper: '#F8F5F8', paperDeep: '#F0EBF0', card: '#FFFDFE', ink: '#382E3A', muted: '#756B77', faint: '#A49BA5', line: '#E3DDE4',
  pine: '#5D4D61', pineSoft: '#F0ECF0', coral: '#5D4D61', coralSoft: '#F2EEF2', gold: '#5D4D61', goldSoft: '#F2EEF2', sky: '#5D4D61', danger: '#A8425C', white: '#FFFFFF'
};

export const themeOptions: Array<{ key: AppThemeName; label: string; detail: string }> = [
  { key: 'warm', label: 'Warm Harvest', detail: 'A quiet cream and forest palette.' },
  { key: 'neutral', label: 'Clean Neutral', detail: 'Crisp white with soft graphite accents.' },
  { key: 'charcoal', label: 'Charcoal', detail: 'A low-glare dark palette.' },
  { key: 'ocean', label: 'Coastal Blue', detail: 'A calm sea-glass palette.' },
  { key: 'orchid', label: 'Orchid Dusk', detail: 'A muted violet palette.' }
];

const themeFile = new File(Paths.document, 'fitness-theme.txt');

function readTheme(): AppThemeName {
  try {
    const value = themeFile.exists ? themeFile.textSync().trim() : '';
    return value === 'neutral' || value === 'charcoal' || value === 'warm' || value === 'ocean' || value === 'orchid' ? value : 'warm';
  } catch {
    return 'warm';
  }
}

export const activeTheme = readTheme();
export const colors = activeTheme === 'neutral' ? neutral : activeTheme === 'charcoal' ? charcoal : activeTheme === 'ocean' ? ocean : activeTheme === 'orchid' ? orchid : warm;
export const isDarkTheme = activeTheme === 'charcoal';
export const atmosphere = { one: 'transparent', two: 'transparent' };

export function saveAppTheme(theme: AppThemeName): void {
  if (!themeFile.exists) themeFile.create({ intermediates: true });
  themeFile.write(theme);
}

export const radii = { small: 10, medium: 16, large: 24, pill: 999 } as const;
export const shadows = { card: { shadowColor: isDarkTheme ? '#000000' : '#3B3120', shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDarkTheme ? 0.2 : 0.08, shadowRadius: 18, elevation: 3 } } as const;
