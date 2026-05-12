import { format, isWithinInterval, setHours, setMinutes } from 'date-fns';

export type SholatType = 'Subuh' | 'Dzuhur' | 'Ashar' | 'Maghrib' | 'Isya' | 'None';

export const SHOLAT_WINDOWS: Record<Exclude<SholatType, 'None'>, { start: [number, number], end: [number, number] }> = {
  Subuh: { start: [4, 0], end: [6, 0] },
  Dzuhur: { start: [11, 45], end: [15, 0] },
  Ashar: { start: [15, 0], end: [18, 0] },
  Maghrib: { start: [18, 0], end: [19, 15] },
  Isya: { start: [19, 15], end: [4, 0] }, // Wraps to next day
};

export function getCurrentSholat(): SholatType {
  const now = new Date();
  
  for (const [sholat, range] of Object.entries(SHOLAT_WINDOWS)) {
    const startTime = setMinutes(setHours(now, range.start[0]), range.start[1]);
    let endTime = setMinutes(setHours(now, range.end[0]), range.end[1]);

    // Handle Isya wrapping to next morning or previous night logic
    if (sholat === 'Isya') {
       if (now.getHours() < 4) {
         const prevDayStart = setMinutes(setHours(new Date(now.getTime() - 86400000), 19), 15);
         const todayEnd = setMinutes(setHours(now, 4), 0);
         if (isWithinInterval(now, { start: prevDayStart, end: todayEnd })) return 'Isya';
       } else {
         const todayStart = setMinutes(setHours(now, 19), 15);
         const nextDayEnd = setMinutes(setHours(new Date(now.getTime() + 86400000), 4), 0);
         if (isWithinInterval(now, { start: todayStart, end: nextDayEnd })) return 'Isya';
       }
       continue;
    }

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
