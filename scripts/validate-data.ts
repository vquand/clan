import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadClanData, resolveClanData } from '../lib/clan-data.ts';
import { validateClanData } from '../lib/clan.ts';

const { members, events } = process.env.CLAN_DATA_FILE
  ? resolveClanData(readFileSync(resolve(process.env.CLAN_DATA_FILE), 'utf8'))
  : loadClanData();
const errors = validateClanData(members, events);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Dữ liệu hợp lệ: ${members.length} thành viên, ${events.length} sự kiện.`,
  );
}
