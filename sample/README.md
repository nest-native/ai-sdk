# Samples

The sample tree follows the same shape as the main quality strategy:

- `00-showcase`: the full integration baseline.
- `01-*` onward: focused samples that isolate one topic each (added in later
  milestones).

## Commands

```bash
npm run ci:sample
npm run showcase
npm run sample:focused
npm run test --workspace nest-native-ai-sdk-showcase
```

`npm run showcase` runs the `00-showcase` workspace when it is present.
`npm run sample:focused` discovers focused samples from `sample/*/package.json`
and runs them in folder order. `npm run ci:sample` runs both.
