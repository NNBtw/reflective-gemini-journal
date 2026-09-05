export type SupportedSafetyRegion = 'IN' | 'TW' | 'EU' | 'GLOBAL';

export function normalizeSafetyRegion(value: unknown): SupportedSafetyRegion {
  return value === 'IN' || value === 'TW' || value === 'EU' ? value : 'GLOBAL';
}

export function buildCrisisResponse(value: unknown): string {
  const region = normalizeSafetyRegion(value);
  const common = `I’m really sorry you’re carrying this right now. Your immediate safety matters more than continuing this journal exercise.

- If you may act on these thoughts or are in immediate danger, contact your local emergency service now or go to the nearest emergency department.
- If possible, move away from anything you could use to hurt yourself and contact someone you trust who can stay with you.`;

  const regionalResources: Record<SupportedSafetyRegion, string> = {
    IN: `
- In India, call **112** for emergency assistance.
- Call **Tele-MANAS 14416** or **1800-89-14416** for 24/7 government tele-mental-health support.`,
    TW: `
- In Taiwan, call **119** or **110** for immediate emergency assistance.
- Call **1925 Lifeline** (24/7). You can also call **1995 LifeLine** or **1980 Teacher Chang**.`,
    EU: `
- In the European Union, call **112** for emergency assistance.
- Find a verified local crisis line at **https://findahelpline.com/**.`,
    GLOBAL: `
- Find a verified crisis or emotional-support service for your country at **https://findahelpline.com/**.`,
  };

  return `${common}${regionalResources[region]}

This app is not an emergency or medical service. These links and numbers are shown deterministically; AI does not choose whether to contact anyone.`;
}
