This private adapter replaces the `fast-glob` dependency used by
`vite-plugin-dynamic-import`, shadcn, and ts-morph. Its callable asynchronous
export and `glob`, `sync`, and `globSync` methods delegate to tinyglobby, with
directory expansion disabled to retain fast-glob's default behavior.

The replacement removes the vulnerable `micromatch` → `braces` implementation;
it does not suppress the audit. There is no patched braces release for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Compatibility tests cover the APIs and options used by these build tools,
including brace patterns, negations, dotfiles, depth, and absolute paths.
This is a scoped adapter for those callers, not a complete fast-glob API.

Remove this override when upstream callers migrate to a maintained globber or
the affected dependency has a patched release. See the
[tinyglobby migration guide](https://superchupu.dev/tinyglobby/migration).
