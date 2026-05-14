import { format, isWithinInterval, setHours, setMinutes } from 'date-fns';

export type SholatType = 'Subuh' | 'Dzuhur' | 'Ashar' | 'Maghrib' | 'Isya' | 'None';

export const SHOLAT_WINDOWS: Record<Exclude<SholatType, 'None'>, { start: [number, number], end: [number, number] }> = {
  Subuh: { start: [4, 0], end: [10, 0] },
  Dzuhur: { start: [11, 30], end: [12, 30] },
  Ashar: { start: [14, 50], end: [15, 30] },
  Maghrib: { start: [17, 15], end: [18, 0] },
  Isya: { start: [18, 30], end: [20, 30] },
};

export function getCurrentSholat(): SholatType {
  const now = new Date();
  const isFriday = now.getDay() === 5; // 0 Sunday, 5 Friday
  
  for (const [sholat, range] of Object.entries(SHOLAT_WINDOWS)) {
    let startH = range.start[0];
    let startM = range.start[1];
    let endH = range.end[0];
    let endM = range.end[1];

    // Friday exception for Dzuhur
    if (sholat === 'Dzuhur' && isFriday) {
      startH = 11;
      startM = 0;
      endH = 12;
      endM = 0;
    }

    const startTime = setMinutes(setHours(setMinutes(setHours(new Date(), 0), 0), startH), startM);
    const endTime = setMinutes(setHours(setMinutes(setHours(new Date(), 0), 0), endH), endM);

    if (isWithinInterval(now, { start: startTime, end: endTime })) {
      return sholat as SholatType;
    }
  }

  return 'None';
}

export function getSholatLabel(sholat: SholatType): string {
  switch (sholat) {
    case 'Subuh': return 'Subuh';
    case 'Dzuhur': return 'Dzuhur';
    case 'Ashar': return 'Ashar';
    case 'Maghrib': return 'Maghrib';
    case 'Isya': return 'Isya';
    default: return 'Bukan Waktu Sholat';
  }
}
