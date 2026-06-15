# Support Policy

The supported runtime and peer lines for `@nest-native/ai-sdk`.

## Supported Versions

| Item | Supported line |
| :--- | :--- |
| Node.js | `>=20` |
| NestJS | `11.x` |
| Vercel AI SDK (`ai`) | `^5` (pin major; pre-v5 not supported) |
| HTTP adapter | Express and Fastify (parity is a project goal) |
| Validation | Zod and class-validator, both app-owned |

The published package keeps `"dependencies": {}`. The AI SDK and the NestJS
packages are declared as `peerDependencies`, so applications install only the
ecosystems they actually use.

## AI SDK Major Version Pin

The AI SDK version pin is critical. **v5 is a hard requirement**; pre-v5 is not
supported. The v4 → v5 rework changed the stream protocol (the UI message stream
and `convertToModelMessages` are v5 APIs), so a v4 application must upgrade the AI
SDK before adopting this package. See the [Migration Guide](migration.md) for the
v4 → v5 note.

Future AI SDK majors will also break the stream protocol. The package pins the
major and budgets for re-issue work at each major bump. Review the AI SDK
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
