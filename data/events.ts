import type { ClanEvent } from './types';

/**
 * Với ngày âm lịch, cập nhật `solarDates` sau khi gia đình đối chiếu lịch mỗi năm.
 * Trang lịch chỉ hiển thị sự kiện âm khi năm đang xem có ngày dương tương ứng.
 */
export const clanEvents: ClanEvent[] = [
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
