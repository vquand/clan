import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const rootRequire = createRequire(import.meta.url);
const require = createRequire(
  rootRequire.resolve('vite-plugin-dynamic-import'),
);

void test('build globbing uses the maintained implementation without the vulnerable braces dependency', () => {
  const metadata = require('fast-glob/package.json');
  assert.equal(metadata.name, '@clan/fast-glob-compat');
  assert.equal(metadata.dependencies.tinyglobby, '0.2.17');
  assert.throws(() => require.resolve('braces'), { code: 'MODULE_NOT_FOUND' });
});

void test('build-tool glob APIs preserve brace patterns, ignores, dotfiles, depth, and absolute paths', async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), 'clan-build-glob-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'src'));
  await mkdir(join(cwd, 'src', 'nested'));
  for (const file of [
    'src/one.ts',
    'src/two.js',
    'src/skip.ts',
    'src/.hidden.ts',
    'src/nested/three.ts',
  ]) {
    await writeFile(join(cwd, file), '');
  }
  const glob = require('fast-glob');
  const patterns = ['src/**/*.{js,ts}', '!**/skip.ts'];
  const expected = ['src/nested/three.ts', 'src/one.ts', 'src/two.js'];
  assert.deepEqual(glob.sync(patterns, { cwd }).sort(), expected);
  assert.deepEqual((await glob(patterns, { cwd })).sort(), expected);
  assert.deepEqual((await glob.glob(patterns, { cwd })).sort(), expected);
  assert.deepEqual(glob.globSync(patterns, { cwd }).sort(), expected);
  assert.deepEqual(glob.sync('src/.hidden.ts', { cwd, dot: true }), [
    'src/.hidden.ts',
  ]);
  assert.deepEqual(glob.sync('src', { cwd }), []);
  assert.deepEqual(glob.sync('src/one.ts', { cwd, absolute: true }), [
    join(cwd, 'src/one.ts'),
  ]);
  assert.deepEqual(glob.sync('**/*.ts', { cwd, deep: 1 }), []);
});

void test('deeply nested brace input does not exhaust the build-process stack', () => {
  const glob = require('fast-glob');
  const pattern = '{'.repeat(5000) + 'missing' + '}'.repeat(5000);
  assert.deepEqual(glob.sync(pattern, { cwd: tmpdir() }), []);
});
