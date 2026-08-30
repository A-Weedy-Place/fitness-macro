const METS: Array<{ terms: string[]; met: number }> = [
  { terms: ['run', 'jog'], met: 8.3 },
  { terms: ['cycle', 'cycling', 'bike', 'ride'], met: 7 },
  { terms: ['strength', 'weights', 'gym', 'lifting'], met: 5 },
  { terms: ['swim'], met: 7 },
  { terms: ['hike'], met: 6 },
  { terms: ['football', 'soccer', 'basketball', 'cricket'], met: 7 },
  { terms: ['yoga'], met: 3 },
  { terms: ['walk'], met: 3.5 }
];

export function activityMet(name: string) {
  const normalized = name.toLowerCase();
  return METS.find((item) => item.terms.some((term) => normalized.includes(term)))?.met || 4;
}

export function estimateActivityCalories(name: string, minutes: number, weightKg: number) {
  const met = activityMet(name);
  return { met, calories: Math.max(0, Math.round(met * 3.5 * weightKg / 200 * minutes)) };
}
