import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const require = createRequire(import.meta.url);
const picomatch = require('picomatch');

void test('all build-tool matchers resolve to the patched local package', () => {
  for (const consumer of ['vite', 'tinyglobby', 'fdir', '@dotenvx/dotenvx']) {
    const consumerRequire = createRequire(
      require.resolve(`${consumer}/package.json`),
    );
    assert.equal(
      consumerRequire('picomatch/package.json').name,
      '@clan/picomatch-compat',
    );
  }
});

void test('matcher preserves normal globs and safe extglobs', () => {
  for (const [pattern, input, expected] of [
    ['**/*.{ts,tsx}', 'src/nested/page.tsx', true],
    ['**/*.ts', 'src/page.js', false],
    ['@(foo|bar).js', 'bar.js', true],
    ['+(ab).js', 'abab.js', true],
    ['+(a|b).js', 'abba.js', true],
    ['+(*(a)|*(b))', 'abba', true],
    ['+(a\\*b)', 'a*ba*b', true],
    ['+("*")', '**', true],
    ['+([*])', '**', true],
  ] as const) {
    assert.equal(picomatch(pattern)(input), expected, `${pattern}: ${input}`);
  }
  const posix = require('picomatch/posix');
  assert.equal(posix('**/*.ts')('src/page.ts'), true);
  assert.equal(posix('+(*)b')('a'.repeat(30) + '!'), false);
});

void test('repeated wildcard extglobs cannot hang the build process', () => {
  const patterns = [
    '+(*)b',
    '+(*a)b',
    '*(a*)b',
    '+(@(*a))b',
    '+(a*(a))b',
    '+([[]*)b',
    '*([[]*)b',
  ];
  const code = `
    const assert = require('node:assert/strict');
    const picomatch = require(${JSON.stringify(require.resolve('picomatch'))});
    for (const pattern of ${JSON.stringify(patterns)}) {
      assert.equal(picomatch(pattern)('a'.repeat(10000) + '!'), false);
      assert.equal(picomatch(pattern)('['.repeat(10000) + '!'), false);
      assert.equal(picomatch(pattern)(pattern), true);
    }
  `;
  const result = spawnSync(process.execPath, ['-e', code], {
    encoding: 'utf8',
    timeout: 3000,
  });
  assert.equal(result.error, undefined, 'Matcher exceeded the process timeout');
  assert.equal(result.status, 0, result.stderr);
});
