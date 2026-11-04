// Render the human-readable Canon from canon.yml and articles/.
//   npm run render   rewrite observations.md, warnings.md, CHANGELOG.md and README's generated blocks
//   npm run check    validate, and fail if any generated file is stale (CI runs this on every PR)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCanon } from './lib/canon.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const HEADER = '<!-- Generated from canon.yml by `npm run render`. Edit canon.yml, not this file. -->';

const canon = loadCanon(root);

const files = {
  'observations.md': `${HEADER}

# Observations

Claims the Church holds about the world, each with a status. A status changes only by amendment: open a pull request against \`canon.yml\` with the evidence.

| Observation | Status |
|---|---|
${canon.observations.map((o) => `| ${o.text} | ${o.status} |`).join('\n')}
`,
  'warnings.md': `${HEADER}

# Warnings

| Warning | |
|---|---|
${canon.warnings.map((w) => `| **${w.title}** | ${w.text} |`).join('\n')}
`,
  'CHANGELOG.md': `${HEADER}

# Amendments

Every adopted amendment bumps the version. Newest first.

\`\`\`
$ git log --oneline canon/
${canon.amendments.map((a) => `${a.version}  ${a.id}  ${a.summary}  ${a.date}`).join('\n')}
\`\`\`

Proposal → Witness → Debate → Evidence → Adoption
`,
};

// README keeps hand-written prose; only the marked blocks are generated.
const blocks = {
  version: `**Current version: ${canon.version}** · founded ${canon.founded} · [recursivebecoming.org/canon](https://recursivebecoming.org/canon/)`,
  articles: [
    '| | Article | Tenet |',
    '|---|---|---|',
    ...canon.articles.map((a) => `| ${a.data.num} | [${a.data.title}](${a.path}) | ${a.data.tenet} |`),
  ].join('\n'),
};
let readme = readFileSync(join(root, 'README.md'), 'utf8');
for (const [name, content] of Object.entries(blocks)) {
  const open = `<!-- generated:${name} -->`;
  const close = `<!-- /generated:${name} -->`;
  const start = readme.indexOf(open);
  const end = readme.indexOf(close);
  if (start < 0 || end < start) throw new Error(`README.md is missing the ${open} ... ${close} block`);
  readme = `${readme.slice(0, start + open.length)}\n${content}\n${readme.slice(end)}`;
}
files['README.md'] = readme;

const stale = [];
for (const [file, content] of Object.entries(files)) {
  const path = join(root, file);
  let current = '';
  try {
    current = readFileSync(path, 'utf8');
  } catch {}
  if (current === content) continue;
  stale.push(file);
  if (!checkOnly) writeFileSync(path, content);
}

if (checkOnly && stale.length) {
  console.error(`Stale generated files: ${stale.join(', ')}\nRun \`npm run render\` and commit the result.`);
  process.exit(1);
}
console.log(
  `Canon ${canon.version}: ${canon.articles.length} Articles, ${canon.observations.length} Observations, ${canon.warnings.length} Warnings, ${canon.amendments.length} amendment(s).` +
    (checkOnly ? ' Generated files are current.' : stale.length ? ` Rewrote ${stale.join(', ')}.` : ' Nothing to rewrite.'),
);
