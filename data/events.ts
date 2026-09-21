import type { ClanEvent } from './types';
import defaultLunarEvents from './default-lunar-events.json' with { type: 'json' };

/**
 * `solarDates` is an optional yearly override for lunar dates that the family
 * has checked. When it is absent, the calendar calculates the solar date and
 * prefers the leap-month occurrence when a lunar month repeats.
 */
const familyEvents: ClanEvent[] = [
  {
    id: 'gio-cu-an',
    title: 'Giỗ cụ Nguyễn Văn An',
    type: 'death-anniversary',
    calendar: 'lunar',
    day: 12,
    month: 3,
    recurrence: 'annual',
    relatedMemberIds: ['an'],
    location: 'Nhà thờ họ',
    description: 'Con cháu có mặt trước 9 giờ để chuẩn bị lễ.',
    solarDates: {
      2026: '2026-04-28',
      2027: '2027-04-18',
    },
  },
  {
    id: 'hop-ho-thang-tu',
    title: 'Họp họ đầu hè',
    type: 'clan-ceremony',
    calendar: 'solar',
    day: 18,
    month: 4,
    recurrence: 'annual',
    relatedMemberIds: [],
    location: 'Nhà thờ họ',
    description: 'Tổng kết quỹ họ và kế hoạch hoạt động trong năm.',
  },
  {
    id: 'trung-thu',
    title: 'Trung thu sum họp',
    type: 'gathering',
    calendar: 'lunar',
    day: 15,
    month: 8,
    recurrence: 'annual',
    relatedMemberIds: [],
    location: 'Sân nhà thờ họ',
    description: 'Buổi gặp mặt dành cho các cháu nhỏ trong gia đình.',
    solarDates: {
      2026: '2026-09-25',
      2027: '2027-09-15',
    },
  },
];

const sharedDefaultEvents = defaultLunarEvents as ClanEvent[];
export const clanEvents: ClanEvent[] = [
  ...familyEvents,
  ...sharedDefaultEvents.filter(
    (event) =>
      !familyEvents.some(
        (existing) =>
          existing.id === event.id ||
          (existing.calendar === event.calendar &&
            existing.day === event.day &&
            existing.month === event.month),
      ),
  ),
];
