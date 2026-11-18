# Patched Picomatch

This private package vendors the runtime files and MIT license from
`picomatch@4.0.7`. Its internal package name is `@clan/picomatch-compat`; version
`4.0.8` identifies this local derivative, not an upstream npm release.

The root npm override sends every Picomatch consumer, including Vite,
tinyglobby, and fdir, to this package. It preserves Picomatch's CommonJS API and
has no extra dependencies or install scripts.

## Security patch

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
affects the upstream matcher through 4.0.7. No patched npm release was available
on November 18, 2026. Patterns such as `+(*)b`, `+(*a)b`, and `*(a*)b` can
generate nested unbounded quantifiers and stall matching a short nonmatch.

The only runtime modification is in `lib/parse.js`:

- add a linear scan for unescaped, unquoted stars outside character classes;
- classify those branches as risky inside repeated extglobs;
- use the existing upstream fallback that treats risky extglobs literally.

Existing safe rewrites for repeated single-character alternatives remain intact.
Normal wildcards, globstars, braces, simple extglobs, escaped stars, and stars
inside quotes or character classes keep their existing behavior. The upstream
explicit unsafe opt-out, `maxExtglobRecursion: false`, is unchanged; project
build tools use the default safeguard.

`tests/picomatch.test.ts` checks compatibility and runs the reported attack
patterns in child processes with a hard timeout. Vendored upstream code is
excluded from project-style linting; the local security patch remains covered
by those behavioral tests.

Remove this package and its override when a verified upstream fix is released.
Run the matcher tests, full test suite, browser suite, build, and audit before
switching back. Do not regenerate or reformat the vendor files: preserving the
upstream source makes the local security patch easy to review.
