# Support Policy

The supported runtime and peer lines for `@nest-native/ai-sdk`.

## Supported Versions

| Item | Supported line |
| :--- | :--- |
| Node.js | `>=22` (required by `ai@7`) |
| NestJS | `11.x` |
| Vercel AI SDK (`ai`) | `^7` (tracks the current major; older majors not supported) |
| HTTP adapter | Express and Fastify (parity is a project goal) |
| Validation | Zod and class-validator, both app-owned |

The published package keeps `"dependencies": {}`. The AI SDK and the NestJS
packages are declared as `peerDependencies`, so applications install only the
ecosystems they actually use.

The Node.js line follows the AI SDK's own requirement: `ai@7` and the
`@ai-sdk/*` v4-spec packages declare `engines.node: '>=22'`, so this package
does too rather than overstating support the peer stack cannot deliver.

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
