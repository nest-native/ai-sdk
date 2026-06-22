# Release Guide

The package release workflow for `@nest-native/ai-sdk`.

## Versioning

The published package follows semantic versioning. Sample, documentation, and
CI-only changes may remain under `Unreleased` in the
[`CHANGELOG.md`](https://github.com/nest-native/ai-sdk/blob/main/CHANGELOG.md)
until the next package release is useful for users.

`0.1.0` is the first user-facing release: the initial `0.x` surface (`@AiStream`,
`@AiAbortSignal`, `AiModule`) on Express and Fastify, with the documentation site
in place. The public API may still change before `1.0`.

## Version Synchronization (mandatory)

Version drift between `packages/ai-sdk` and `sample/*` is a release blocker. When
bumping `packages/ai-sdk/package.json`:

1. Update every `sample/*/package.json` entry for `@nest-native/ai-sdk` in the
   same change.
2. Regenerate `package-lock.json`.
3. Run `npm run release:check` (link validation, sample version sync, and tarball
   validation).
4. Run `npm run ci`.

The `release:check:sample-versions` script fails the build if any sample, the
lockfile, or the workspace resolution disagrees with the package version.

## Release Steps

1. Decide the new version and update `packages/ai-sdk/package.json`.
2. Update all `sample/*/package.json` and regenerate the lockfile.
3. Move the relevant `CHANGELOG.md` entries from `Unreleased` into a dated
   version section.
4. Run `npm run release:check` and `npm run ci` — both must pass.
5. Merge to `main` via PR.
6. Tag the release (`vX.Y.Z`) on `main`.

## Publishing

Publishing to npm is performed out of band by a maintainer with credentials. The
CI pipeline never publishes. After a publish, re-run full CI with samples pinned
to the published version.

## AI SDK Major

The `ai` peer tracks the current major: `^6`. Older majors are not supported;
document this prominently. When the AI SDK ships a new major, adopt it — bump
the peer range, migrate the source/samples/fixtures, and release it as a
breaking peer change. Review the AI SDK changelog at every bump. See the
[Support Policy](support-policy.md).
