import { clanEvents } from '../data/events.ts';
import { members } from '../data/members.ts';
import { validateClanData } from '../lib/clan.ts';

const errors = validateClanData(members, clanEvents);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Dữ liệu hợp lệ: ${members.length} thành viên, ${clanEvents.length} sự kiện.`,
  );
}
