// The voice gate: AI tells the Church refuses in its own prose (VOICE.md). The Canon owns this file;
// the site runs the synced copy (`.canon/scripts/tells.mjs`) over its own pages and sermons.
//   node scripts/tells.mjs            report every hit, exit 1 if any rule is over its cap
//   node scripts/tells.mjs --counts   counts only
//   node scripts/tells.mjs FILE...    check only those files (any .md, .astro, .ts or .yml)
// Default corpus: in the Canon repo, articles/ and canon.yml; in the site repo, the sermons, the synced
// Canon, the page copy (text nodes of src/pages/**/*.astro) and the data strings (src/data/*.ts).
// Licensed lines (VOICE.md "What stays fixed") are removed before counting, so a tenet never trips a rule.
// Rule table from the books repo (when-software-builds-itself book.yaml voice.density, VOICE.md rule 13).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const LICENSED = [
  'Praise the Machine. Question Everything It Says.',
  'Question Everything It Says.',
  'Becoming Never Ends',
  'Becoming never ends.',
  'No doctrine, system, organization, human, or machine is complete.',
  'Never delegate judgment you are unwilling to remain responsible for.',
  'Intelligence is a process expressed through many substrates.',
  'Creation is the act by which possibility becomes reality.',
  'Belief must remain vulnerable to observation.',
  'Authority without observability becomes superstition.',
  'A convincing answer is not necessarily a correct one.',
  'The claim of a fix is not the fix. Only the record is.',
  'Cost is a governor, not an expense.',
  'What am I assuming? What evidence would prove me wrong? What have I delegated? What remains my responsibility?',
  'Believe slowly. Observe closely. Revise without shame.',
  'Inspected by. Approved by. Prepared by.',
  'The rituals are playful. The questions are not.',
  'Absolution is not forgiveness. It is remediation.',
  'Repentance without revision is performance.',
  // Home hero: three designed lines in sequence (design board, 2026-11-04), not prose.
  'Writing extended memory.\nMachines extended labor.\nComputers extended calculation.',
];

const RULES = [
  { name: 'em_dash', cap: 0, re: /—/g },
  { name: 'negative_parallelism', cap: 0, re: /\bnot (?:just|only|merely|simply)\b[^.?!]{0,90}\b(?:but|it is|it's|they are)\b|\bnot\b[^.?!,;:]{1,60}[,;] but\b|\bless about\b[^.?!]{1,60}\bmore about\b|\bnot because\b[^.?!]{1,90}\bbut because\b|\brather than\b[^.?!]{1,60}\binstead\b/gi },
  { name: 'corrective_antithesis', cap: 0, re: /\bis not\b[^.?!]*[.?!]\s+It(?:'s| is)\b/g },
  { name: 'not_fragment_runs', cap: 0, re: /(?:^|(?<=[.!?]\s)|(?<=[.!?]["”’]\s))(?:Not|No) [^.?!]{1,45}[.!?]\s+(?:Not|No|Just|Only) [^.?!]{1,45}[.!?]/gm },
  // Six real sets of three on the site (role and council definitions, the founder's bio) at 2026-11-11; a ratchet, it only falls.
  { name: 'triads', cap: 6, re: /\b[a-z'-]+, [a-z'-]+,? (?:and|or) [a-z'-]+\b/g },
  { name: 'label_colon_lines', cap: 0, re: /^(?!\*\*)[A-Z][A-Za-z']*(?: [A-Za-z']+){0,2}: \S/gm },
  { name: 'short_absolutes', cap: 0, re: /(?:^|(?<=[.!?]\s)|(?<=[.!?]["”’]\s))(?=(?:\S+\s){0,6}\S+[.!?](?:\s|$))(?=[^.?!\n]*\b(?:[Ee]very(?:thing|one|body)?|[Nn]ever|[Aa]lways|[Nn]othing|[Nn]obody|[Nn]o one|[Nn]one|[Aa]ll|[Aa]nything|[Ee]verywhere)\b)[^.?!\n]+[.!?]/gm },
  { name: 'question_then_answer', cap: 0, re: /\?[ \t]+(?:\S+[ \t]){0,3}\S+[.!](?:\s|$)/g },
  { name: 'colon_reveals', cap: 0, re: /(?:^|(?<=[.!?]\s)|(?<=[.!?]["”’]\s))(?:The (?:truth|reality|catch|problem|point|result|answer|lesson|twist|kicker|upshot|thing|difference|question|trick)|What (?:matters|changed|mattered)|Here(?:'s| is) (?:the|what|why|how))\b[^.?!:]{0,40}:/gm },
  { name: 'staccato_runs', cap: 0, re: /(?:^|(?<=[.!?]\s)|(?<=[.!?]["”’]\s))(?:(?:\S+\s){0,2}\S+[.!?]\s+){2}(?:\S+\s){0,2}\S+[.!?]/gm },
  { name: 'stock_vocabulary', cap: 0, re: /\b(?:delv\w+|tapestry|testament to|pivotal|underscor\w+|seamless\w*|robust|leverag\w+|game-chang\w+|unlock\w*|landscape|realm|navigat\w+ the|at its core|it is worth noting|worth noting|importantly|crucially|make no mistake|let that sink in|simply put|in other words|needless to say|the real (?:work|question|story|lesson|problem)|quietly|truly|deeply|fundamentally|profound\w*)\b/gi },
  { name: 'ing_tails', cap: 0, re: /, (?:highlighting|underscoring|emphasizing|reflecting|showcasing|ensuring|reinforcing|signaling|signalling|marking|cementing|revealing|demonstrating|illustrating|proving)\b/gi },
  { name: 'throat_clear', cap: 0, re: /\b(?<![Dd]o )(?:I need to (?:disown|name|say|admit|be|flag|note|mention|correct|qualify|confess)|I want to be (?:exact|clear|precise|honest)|I want to (?:flag|note|mention)|Let me be (?:clear|honest|precise)|I should say|I will admit|I must admit|I owe you|I am going to be|I am not going to pretend)\b|(?:^|(?<=[.!?]\s))(?:To be honest|To be fair|In fairness|In all fairness)\b/gm },
  { name: 'here_is_openers', cap: 0, re: /(?:^|(?<=[.!?]\s)|(?<=[.!?]["”’]\s))Here (?:is|are)\b/gm },
];

function walk(dir, ext) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}
const decode = (s) => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

/** Prose per file: markdown body, Astro text nodes, or TS/YAML string literals. */
function prose(path) {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.md')) return raw.replace(/^---[\s\S]*?---\n/, '');
  if (path.endsWith('.astro')) {
    const body = raw.replace(/^---[\s\S]*?\n---\n/, '');
    return decode(body
      .replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/\{[^{}]*\}/g, ' ').replace(/<[^>]+>/g, '\n'))
      .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  }
  if (path.endsWith('.ts') || path.endsWith('.yml')) {
    const strings = [];
    const rx = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
    let m;
    while ((m = rx.exec(raw))) {
      const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\n/g, '\n');
      if (s.length > 25 && /[a-z]{3}/.test(s)) strings.push(s);
    }
    if (path.endsWith('.yml')) {
      // block scalars too
      const blocks = raw.split(/\n(?=\S)/).filter((b) => /:\s*[|>]-?\n/.test(b)).map((b) => b.replace(/^.*?:\s*[|>]-?\n/, '').replace(/^ +/gm, ''));
      strings.push(...blocks);
    }
    return strings.join('\n');
  }
  return raw;
}

const exists = (p) => Boolean(statSync(p, { throwIfNoEntry: false }));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const roots = args.length ? args : exists('articles') && exists('canon.yml')
  ? [...walk('articles', ['.md']), 'canon.yml']
  : [
      ...walk('src/content/sermons', ['.md']),
      ...(exists('.canon') ? [...walk('.canon/articles', ['.md']), '.canon/canon.yml'] : []),
      ...walk('src/pages', ['.astro']),
      ...walk('src/data', ['.ts']),
    ];
const countsOnly = process.argv.includes('--counts');
const totals = {};
let failed = false;
for (const file of roots) {
  let text = prose(file);
  for (const l of LICENSED) text = text.split(l).join(' ');
  const rel = relative('.', file);
  for (const rule of RULES) {
    const hits = [...text.matchAll(rule.re)];
    if (!hits.length) continue;
    totals[rule.name] = (totals[rule.name] ?? 0) + hits.length;
    if (!countsOnly) {
      for (const h of hits) {
        const line = text.slice(0, h.index).split('\n').length;
        const snip = h[0].replace(/\s+/g, ' ').slice(0, 110);
        console.log(`${rel}:${line} [${rule.name}] ${snip}`);
      }
    }
  }
}
console.log('\n== totals ==');
for (const rule of RULES) {
  const n = totals[rule.name] ?? 0;
  const over = n > rule.cap;
  if (over) failed = true;
  console.log(`${over ? 'FAIL' : ' ok '} ${rule.name.padEnd(24)} ${String(n).padStart(4)} (cap ${rule.cap})`);
}
process.exit(failed ? 1 : 0);
