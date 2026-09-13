import assert from 'node:assert/strict';
import test from 'node:test';

import { splitSqlStatements } from '../scripts/sql-statements.mjs';

void test('splits migration statements without splitting quoted semicolons', () => {
  assert.deepEqual(
    splitSqlStatements(
      "ALTER TABLE members ADD COLUMN note TEXT DEFAULT 'line;age';\n" +
        'COMMENT ON COLUMN members.note IS $$A note; with punctuation$$;',
    ),
    [
      "ALTER TABLE members ADD COLUMN note TEXT DEFAULT 'line;age'",
      'COMMENT ON COLUMN members.note IS $$A note; with punctuation$$',
    ],
  );
});
