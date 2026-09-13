const TIME_ZONE = 7;
const NEW_MOON_EPOCH = 2415021.076998695;
const SYNODIC_MONTH = 29.530588853;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface LunarDate {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
}

interface SolarDate {
  year: number;
  month: number;
  day: number;
}

function julianDayFromDate(day: number, month: number, year: number) {
  const adjustment = Math.floor((14 - month) / 12);
  const adjustedYear = year + 4800 - adjustment;
  const adjustedMonth = month + 12 * adjustment - 3;
  return (
    day +
    Math.floor((153 * adjustedMonth + 2) / 5) +
    365 * adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) -
    32045
  );
}

function solarDateFromJulianDay(julianDay: number): SolarDate {
  let adjustedJulianDay = julianDay;
  if (adjustedJulianDay > 2299160) {
    const alpha = Math.floor((adjustedJulianDay - 1867216.25) / 36524.25);
    adjustedJulianDay += 1 + alpha - Math.floor(alpha / 4);
  }
  const beta = adjustedJulianDay + 1524;
  const gamma = Math.floor((beta - 122.1) / 365.25);
  const delta = Math.floor(365.25 * gamma);
  const epsilon = Math.floor((beta - delta) / 30.6001);
  const day = beta - delta - Math.floor(30.6001 * epsilon);
  const month = epsilon < 14 ? epsilon - 1 : epsilon - 13;
  const year = month > 2 ? gamma - 4716 : gamma - 4715;
  return { year, month, day };
}

function newMoon(k: number) {
  const time = k / 1236.85;
  const timeSquared = time * time;
  const timeCubed = timeSquared * time;
  const julianDate =
    2415020.75933 +
    29.53058868 * k +
    0.0001178 * timeSquared -
    0.000000155 * timeCubed;
  const solarAnomaly =
    359.2242 + 29.1053567 * k - 0.0000333 * timeSquared - 0.00000347 * timeCubed;
  const lunarAnomaly =
    306.0253 + 385.81691806 * k + 0.0107306 * timeSquared + 0.00001236 * timeCubed;
  const argument =
    21.2964 + 390.67050646 * k - 0.0003523 * timeSquared - 0.00000011 * timeCubed;
  let correction =
    (0.1734 - 0.000393 * time) *
      Math.sin(solarAnomaly * DEGREES_TO_RADIANS) +
    0.0021 * Math.sin(2 * solarAnomaly * DEGREES_TO_RADIANS) -
    0.4068 * Math.sin(lunarAnomaly * DEGREES_TO_RADIANS) +
    0.0161 * Math.sin(2 * lunarAnomaly * DEGREES_TO_RADIANS) -
    0.0004 * Math.sin(3 * lunarAnomaly * DEGREES_TO_RADIANS) +
    0.0104 * Math.sin(2 * argument * DEGREES_TO_RADIANS) -
    0.0051 * Math.sin((solarAnomaly + lunarAnomaly) * DEGREES_TO_RADIANS) -
    0.0074 * Math.sin((solarAnomaly - lunarAnomaly) * DEGREES_TO_RADIANS) +
    0.0004 * Math.sin((2 * argument + solarAnomaly) * DEGREES_TO_RADIANS) -
    0.0004 * Math.sin((2 * argument - solarAnomaly) * DEGREES_TO_RADIANS) -
    0.0006 * Math.sin((2 * argument + lunarAnomaly) * DEGREES_TO_RADIANS) +
    0.001 * Math.sin((2 * argument - lunarAnomaly) * DEGREES_TO_RADIANS) +
    0.0005 * Math.sin((2 * lunarAnomaly + solarAnomaly) * DEGREES_TO_RADIANS);
  const deltaTime =
    time < -11
      ? 0.001 +
        0.000839 * time +
        0.0002261 * timeSquared -
        0.00000845 * timeCubed -
        0.000000081 * timeSquared * timeCubed
      : -0.000278 + 0.000265 * time + 0.000262 * timeSquared;
  correction = julianDate + correction - deltaTime;
  return correction;
}

function sunLongitude(julianDay: number) {
  const time = (julianDay - 2451545) / 36525;
  const timeSquared = time * time;
  const solarAnomaly =
    357.5291 + 35999.0503 * time - 0.0001559 * timeSquared - 0.00000048 * time * timeSquared;
  const meanLongitude =
    280.46645 + 36000.76983 * time + 0.0003032 * timeSquared;
  const equationOfCenter =
    (1.9146 - 0.004817 * time - 0.000014 * timeSquared) *
      Math.sin(DEGREES_TO_RADIANS * solarAnomaly) +
    (0.019993 - 0.000101 * time) *
      Math.sin(2 * DEGREES_TO_RADIANS * solarAnomaly) +
    0.00029 * Math.sin(3 * DEGREES_TO_RADIANS * solarAnomaly);
  const longitude = (meanLongitude + equationOfCenter) * DEGREES_TO_RADIANS;
  return longitude - Math.floor(longitude / (2 * Math.PI)) * 2 * Math.PI;
}

function getNewMoonDay(k: number) {
  return Math.floor(newMoon(k) + 0.5 + TIME_ZONE / 24);
}

function getSunLongitude(dayNumber: number) {
  return Math.floor((sunLongitude(dayNumber - 0.5 - TIME_ZONE / 24) / Math.PI) * 6);
}

function getLunarMonth11(year: number) {
  const offset = julianDayFromDate(31, 12, year) - NEW_MOON_EPOCH;
  const k = Math.floor(offset / SYNODIC_MONTH);
  let monthStart = getNewMoonDay(k);
  if (getSunLongitude(monthStart) >= 9) monthStart = getNewMoonDay(k - 1);
  return monthStart;
}

function getLeapMonthOffset(lunarMonth11: number) {
  const k = Math.floor(0.5 + (lunarMonth11 - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let lastSunLongitude = 0;
  let monthIndex = 1;
  let sunLongitudeAtMonth = getSunLongitude(getNewMoonDay(k + monthIndex));
  while (sunLongitudeAtMonth !== lastSunLongitude && monthIndex < 14) {
    lastSunLongitude = sunLongitudeAtMonth;
    monthIndex += 1;
    sunLongitudeAtMonth = getSunLongitude(getNewMoonDay(k + monthIndex));
  }
  return monthIndex - 1;
}

function convertSolarToLunar(solar: SolarDate): LunarDate {
  const dayNumber = julianDayFromDate(solar.day, solar.month, solar.year);
  const k = Math.floor((dayNumber - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let monthStart = getNewMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
  let lunarMonth11 = getLunarMonth11(solar.year);
  const lunarMonth11Next = getLunarMonth11(solar.year + 1);
  let lunarYear = solar.year;
  if (lunarMonth11 >= monthStart) {
    lunarYear = solar.year;
    lunarMonth11 = getLunarMonth11(solar.year - 1);
  } else {
    lunarYear = solar.year + 1;
  }
  const monthOffset = Math.floor((monthStart - lunarMonth11) / 29);
  let lunarMonth = monthOffset + 11;
  let isLeapMonth = false;
  if (lunarMonth11Next - lunarMonth11 > 365) {
    const leapMonthOffset = getLeapMonthOffset(lunarMonth11);
    if (monthOffset >= leapMonthOffset) {
      lunarMonth = monthOffset + 10;
      isLeapMonth = monthOffset === leapMonthOffset;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && monthOffset < 4) lunarYear -= 1;
  return {
    year: lunarYear,
    month: lunarMonth,
    day: dayNumber - monthStart + 1,
    isLeapMonth,
  };
}

function convertLunarToSolar(
  lunar: Pick<LunarDate, 'year' | 'month' | 'day'>,
  preferLeapMonth: boolean,
): SolarDate | null {
  let lunarMonth11: number;
  let lunarMonth11Next: number;
  if (lunar.month < 11) {
    lunarMonth11 = getLunarMonth11(lunar.year - 1);
    lunarMonth11Next = getLunarMonth11(lunar.year);
  } else {
    lunarMonth11 = getLunarMonth11(lunar.year);
    lunarMonth11Next = getLunarMonth11(lunar.year + 1);
  }
  const k = Math.floor(0.5 + (lunarMonth11 - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let monthOffset = lunar.month - 11;
  if (monthOffset < 0) monthOffset += 12;
  let leapMonthNumber = 0;
  let wantsLeapMonth = false;
  if (lunarMonth11Next - lunarMonth11 > 365) {
    const leapMonthOffset = getLeapMonthOffset(lunarMonth11);
    leapMonthNumber = ((leapMonthOffset + 10) % 12) || 12;
    wantsLeapMonth = preferLeapMonth && lunar.month === leapMonthNumber;
    if (wantsLeapMonth || monthOffset >= leapMonthOffset) monthOffset += 1;
  }
  const monthStart = getNewMoonDay(k + monthOffset);
  const solar = solarDateFromJulianDay(monthStart + lunar.day - 1);
  const convertedBack = convertSolarToLunar(solar);
  const expectedLeap = wantsLeapMonth;
  if (
    convertedBack.year !== lunar.year ||
    convertedBack.month !== lunar.month ||
    convertedBack.day !== lunar.day ||
    convertedBack.isLeapMonth !== expectedLeap
  ) {
    return null;
  }
  return solar;
}

export function getLunarDate(date: Date): LunarDate {
  return convertSolarToLunar({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

export function getSolarDateFromLunar(
  lunar: Pick<LunarDate, 'year' | 'month' | 'day'>,
  { preferLeapMonth = true }: { preferLeapMonth?: boolean } = {},
) {
  if (
    !Number.isInteger(lunar.year) ||
    !Number.isInteger(lunar.month) ||
    !Number.isInteger(lunar.day) ||
    lunar.month < 1 ||
    lunar.month > 12 ||
    lunar.day < 1 ||
    lunar.day > 30
  ) {
    return null;
  }
  const solar = convertLunarToSolar(lunar, preferLeapMonth);
  if (!solar) return null;
  return `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(
    solar.day,
  ).padStart(2, '0')}`;
}
