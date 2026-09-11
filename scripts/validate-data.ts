import { loadClanData } from '../lib/clan-data.ts';
import { validateClanData } from '../lib/clan.ts';

const { members, events } = loadClanData();
const errors = validateClanData(members, events);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Dữ liệu hợp lệ: ${members.length} thành viên, ${events.length} sự kiện.`,
  );
}
