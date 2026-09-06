# Support Policy

The supported runtime and peer lines for `@nest-native/ai-sdk`.

## Supported Versions

| Item | Supported line |
| :--- | :--- |
| Node.js | `>=22` (required by `ai@7`; `>=22.12` with NestJS 12 — see the note below the table) |
| NestJS (`@nestjs/common`, `@nestjs/core` peers) | `^11.0.0 \|\| ^12.0.0` |
| Vercel AI SDK (`ai`) | `^7` (tracks the current major; older majors not supported) |
| HTTP adapter | Express and Fastify (parity is a project goal) |
| Validation | Zod and class-validator, both app-owned |

The published package keeps `"dependencies": {}`. The AI SDK and the NestJS
packages are declared as `peerDependencies`, so applications install only the
ecosystems they actually use.

The Node.js line follows the AI SDK's own requirement: `ai@7` and the
`@ai-sdk/*` v4-spec packages declare `engines.node: '>=22'`, so this package
does too rather than overstating support the peer stack cannot deliver.

The floor then depends on which end of the NestJS range you are on. NestJS 11
runs on any Node.js `>=22`. NestJS 12 is ESM-only, and a CommonJS application
loads it through Node's `require(esm)`, which is behind a flag before Node.js
22.12.0 — so the 12 end of the range needs Node.js `>=22.12`. `engines` stays
`>=22` because the 11 end does not need more, and the `@nestjs/*@12` packages'
own `engines` field (`>= 20`) does not encode that floor, so npm never warns
about it: run NestJS 12 on a current Node 22 or 24. CI's `nestjs-latest-major`
leg runs on a current 22.x.

## NestJS Major Version

The `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, and
`@nestjs/platform-fastify` peers accept `^11.0.0 || ^12.0.0`. Both ends of that
range are tested claims, not declarations: the default install tests 11 (the
devDependencies and the lockfile stay on 11 on purpose), and the
`nestjs-latest-major` CI leg installs `@nestjs/*@12` with `--no-save`, proves
every workspace — the package and all eight samples — resolves the 12 major,
and runs the suite and the full sample matrix against it.

Two NestJS 12 changes are worth knowing when you upgrade:

- **NestJS 12 is ESM-only.** `@nestjs/common` and `@nestjs/core` ship an
  `exports` map that resolves file paths (`./*` → `./*.js`) but no directory
  indexes. The package source imports only the `@nestjs/common` and
  `@nestjs/core` roots, so it is unaffected; a CommonJS application (the samples
  here run `ts-node` in CommonJS mode) loads it through `require(esm)`, which
  is why the 12 end needs Node.js `>=22.12` (see the Node.js note above).
- **Lifecycle hooks run in a different order.** NestJS 12 calls
  `onModuleInit`, `onApplicationBootstrap`, and the shutdown hooks by component
  hierarchy level, which can change their execution order when providers or
  modules depend on one another. The package implements no lifecycle hook and
  depends on no cross-provider hook order, so nothing here observes the change.

## AI SDK Major Version

The AI SDK major is critical. The peer range tracks the **current major**:
`ai ^7`. Older majors are not supported — each AI SDK major reworks the stream
protocol and/or the provider specification (v7 moved the language-model provider
interface from `v3` to `v4`), so an application on an older major must upgrade
the AI SDK before adopting the matching release of this package. See the
[Migration Guide](migration.md) for the version note.

Rather than holding a legacy major, the package adopts each new AI SDK major:
the peer range is bumped, the source/samples/fixtures are migrated to the new
API, and the change ships as a breaking peer release. Review the AI SDK
changelog at every bump.

## `@Sse` Bug Tracking

Part of this package's design works around
[`nestjs/nest#12670`](https://github.com/nestjs/nest/issues/12670) (the `@Sse`
connection opens before the handler runs). If Nest core fixes that defect, parts
of the design may be re-evaluated at the corresponding Nest minor. The package
does not depend on the bug being fixed and does not pre-fix it.

## Stability

The package is pre-`1.0`. The public API surface (`@AiStream`, `@AiAbortSignal`,
`AiModule`) is the current `0.x` public API described in the
[API Reference](api-reference.md); per semver it may still change before `1.0`
(pin a version), and the [Roadmap](roadmap.md) covers what is intentionally out of
scope.
