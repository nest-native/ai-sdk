#!/usr/bin/env node

// Guards the version literals humans read, which no other release check covers:
// the `**Status: `X.Y.Z`` markers, shields.io badges, and the compatibility
// tables in the root README, the package READMEs, and CONTRIBUTING.md.
//
// Rules:
// 1. Every `**Status: `X.Y.Z`` marker must state a current package version, and
//    a package's own README must state that package's version. Root README and
//    CONTRIBUTING.md must carry the marker too — it is the one canonical way
//    these docs state "what version is this".
// 2. Version badges must be dynamic (`img.shields.io/npm/v/<package>`), so they
//    cannot go stale. Hardcoded `img.shields.io/badge/version-` and
//    `img.shields.io/badge/status-` literals are rejected outright.
// 3. Compatibility-table rows that pin a runtime must match package.json: the
//    Node.js row must state `engines.node`, and a peer row must state that
//    peer's declared range.

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packages = collectPublishedPackages();
const knownVersions = new Set(packages.map(entry => entry.version));
const documents = collectDocuments();
const failures = [];

const statusPattern = /\*\*Status: `(\d+\.\d+\.\d+)`/g;
const staleBadgePattern = /img\.shields\.io\/badge\/(?:version|status)-[^"')\s]*/g;

if (packages.length === 0) {
  throw new Error('README version sync failed: no publishable packages/*/package.json found.');
}

for (const document of documents) {
  const contents = fs.readFileSync(path.join(repoRoot, document.relativePath), 'utf8');
  const expectedVersions = document.package ? [document.package.version] : [...knownVersions];
  const statusVersions = [...contents.matchAll(statusPattern)].map(match => match[1]);

  if (statusVersions.length === 0) {
    failures.push(
      `${document.relativePath} has no '**Status: \`X.Y.Z\`' marker; expected one stating ${expectedVersions.join(' or ')}`,
    );
  }

  for (const statusVersion of statusVersions) {
    if (!expectedVersions.includes(statusVersion)) {
      failures.push(
        `${document.relativePath} states '**Status: \`${statusVersion}\`'; expected ${expectedVersions.join(' or ')}`,
      );
    }
  }

  for (const staleBadge of contents.match(staleBadgePattern) ?? []) {
    failures.push(
      `${document.relativePath} hardcodes the badge '${staleBadge}'; use the dynamic badge 'https://img.shields.io/npm/v/<package>.svg' instead`,
    );
  }

  if (document.requiresVersionBadge) {
    const badgeOwners = document.package ? [document.package] : packages;
    const hasDynamicBadge = badgeOwners.some(entry =>
      contents.includes(`img.shields.io/npm/v/${entry.name}`),
    );

    if (!hasDynamicBadge) {
      failures.push(
        `${document.relativePath} has no dynamic version badge; expected 'https://img.shields.io/npm/v/${badgeOwners[0].name}.svg'`,
      );
    }
  }

  for (const entry of document.package ? [document.package] : packages) {
    failures.push(...checkCompatibilityTable(document.relativePath, contents, entry));
  }
}

if (failures.length > 0) {
  throw new Error(`README version sync failed:\n${failures.join('\n')}`);
}

console.log(
  `README version sync OK: ${documents.length} docs state ${packages
    .map(entry => `${entry.name}@${entry.version}`)
    .join(', ')} with dynamic version badges.`,
);

function collectPublishedPackages() {
  const packagesRoot = path.join(repoRoot, 'packages');
  if (!fs.existsSync(packagesRoot)) {
    return [];
  }

  return fs
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join('packages', entry.name, 'package.json'))
    .filter(packagePath => fs.existsSync(path.join(repoRoot, packagePath)))
    .sort()
    .map(packagePath => ({ packagePath, manifest: readJson(packagePath) }))
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ packagePath, manifest }) => ({
      name: manifest.name,
      version: manifest.version,
      readmePath: path.join(path.dirname(packagePath), 'README.md'),
      engines: manifest.engines ?? {},
      peerDependencies: manifest.peerDependencies ?? {},
    }));
}

function collectDocuments() {
  const rootDocuments = [
    { relativePath: 'README.md', package: null, requiresVersionBadge: true },
    { relativePath: 'CONTRIBUTING.md', package: null, requiresVersionBadge: false },
  ].filter(document => fs.existsSync(path.join(repoRoot, document.relativePath)));

  const packageDocuments = packages
    .filter(entry => fs.existsSync(path.join(repoRoot, entry.readmePath)))
    .map(entry => ({
      relativePath: entry.readmePath,
      package: entry,
      requiresVersionBadge: true,
    }));

  return [...rootDocuments, ...packageDocuments];
}

// Compatibility tables are markdown rows like `| Node.js | \`>=22\` (…) |`. Only
// rows that can be tied back to package.json are checked: the runtime row must
// quote `engines.node`, and a row naming a peer must quote that peer's range.
function checkCompatibilityTable(relativePath, contents, entry) {
  const tableFailures = [];
  const rows = contents
    .split('\n')
    .filter(line => line.trimStart().startsWith('|'))
    .map(line => line.split('|').map(cell => cell.trim()))
    .filter(cells => cells.length >= 4);

  for (const cells of rows) {
    const [, label, value] = cells;

    if (label === 'Node.js' && entry.engines.node && !value.includes(`\`${entry.engines.node}\``)) {
      tableFailures.push(
        `${relativePath} compatibility table says Node.js ${value}; ${entry.name} declares engines.node \`${entry.engines.node}\``,
      );
    }

    for (const [peerName, peerRange] of Object.entries(entry.peerDependencies)) {
      if (label.includes(`\`${peerName}\``) && !value.includes(`\`${peerRange}\``)) {
        tableFailures.push(
          `${relativePath} compatibility table says ${peerName} ${value}; ${entry.name} declares the peer range \`${peerRange}\``,
        );
      }
    }
  }

  return tableFailures;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}
