// Node charters. The rule is read mechanically so no one has to bless a node by hand:
// three gatherings in the last six months, three or more people at each, reported by the applicant.
// Pure functions only; the GitHub calls live in triage.mjs and command.mjs.

export const NODE_RULE = { gatherings: 3, months: 6, minPeople: 3 };
const WINDOW_DAYS = 183;
const DAY = 86_400_000;

/** The value under an issue-form heading ("### Label" then the answer), or '' if absent or unanswered. */
export function formField(body, label) {
  const lines = String(body ?? '').replace(/\r\n/g, '\n').split('\n');
  const want = `### ${label}`.toLowerCase();
  const start = lines.findIndex((l) => l.trim().toLowerCase() === want);
  if (start < 0) return '';
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('### ')) break;
    out.push(line);
  }
  const value = out.join('\n').trim();
  return value === '_No response_' ? '' : value;
}

/** Issue numbers referenced as #12 or .../issues/12, in order, without repeats. */
export function referencedIssues(text) {
  const nums = [...String(text ?? '').matchAll(/(?:#|\/issues\/)(\d+)\b/g)].map((m) => Number(m[1]));
  return [...new Set(nums)];
}

const hasLabel = (issue, name) => (issue.labels ?? []).some((l) => (l.name ?? l) === name);

/** What a gathering report says, read from its issue-form fields. */
export function readGathering(issue) {
  const date = formField(issue.body, 'Date');
  const people = Number.parseInt(formField(issue.body, 'How many people'), 10);
  return {
    number: issue.number,
    isGathering: hasLabel(issue, 'gathering'),
    author: issue.user?.login ?? '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    people: Number.isFinite(people) ? people : 0,
  };
}

/**
 * Check a charter against the rule.
 * @param applicant login of the person asking to charter
 * @param gatherings readGathering() results, or { number, missing: true } for reports that do not exist
 * @param today a Date
 */
export function checkCharter({ applicant, gatherings, today = new Date() }) {
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const seenDates = new Set();
  const rows = gatherings.map((g) => {
    const problems = [];
    if (g.missing) problems.push('no such report');
    else {
      if (!g.isGathering) problems.push('not a gathering report');
      if (g.author.toLowerCase() !== String(applicant).toLowerCase()) problems.push('reported by someone else');
      if (!g.date) problems.push('no date');
      else {
        const t = Date.parse(`${g.date}T00:00:00Z`);
        if (t > now + DAY) problems.push('dated in the future');
        else if (now - t > WINDOW_DAYS * DAY) problems.push('more than six months ago');
        else if (seenDates.has(g.date)) problems.push('same day as another report');
      }
      if (g.people < NODE_RULE.minPeople) problems.push(`fewer than ${NODE_RULE.minPeople} people`);
    }
    if (!problems.length) seenDates.add(g.date);
    return { ...g, ok: problems.length === 0, problems };
  });
  const counted = rows.filter((r) => r.ok).length;
  return { rows, counted, meets: counted >= NODE_RULE.gatherings };
}

/** Submitter text made safe for a Markdown table cell: no pipes, links, HTML, mentions, or emphasis. */
export function cleanCell(text, max = 60) {
  return String(text ?? '')
    .replace(/[|[\]()<>@`*_~\\!#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const rowFor = (markdown, number) =>
  markdown.split('\n').findIndex((l) => l.startsWith('| [') && new RegExp(`/issues/${number}\\)`).test(l));

/** NODES.md with a new Active row, or null if this charter is already on the roll. */
export function addNode(markdown, { name, city, steward, date, number, repo }) {
  if (rowFor(markdown, number) >= 0) return null;
  const row = `| [${cleanCell(name) || 'Unnamed node'}](https://github.com/${repo}/issues/${number}) | ${cleanCell(city) || 'Unlisted'} | [@${steward}](https://github.com/${steward}) | ${date} | Active |`;
  return `${markdown.trimEnd()}\n${row}\n`;
}

/** The roll's rows: charter number, Steward login, status. */
export function parseNodes(markdown) {
  const re = /^\| \[.*?\]\(https:\/\/github\.com\/[^)]+\/issues\/(\d+)\) \| .*? \| \[@([\w-]+)\]\([^)]*\) \| (\d{4}-\d{2}-\d{2}) \| (Active|Dormant) \|$/;
  return markdown
    .split('\n')
    .map((l) => re.exec(l))
    .filter(Boolean)
    .map((m) => ({ number: Number(m[1]), steward: m[2], chartered: m[3], status: m[4] }));
}

/** True if a node chartered or last met on `lastDate` has gone six months without a gathering. */
export function isLapsed(lastDate, today = new Date()) {
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return now - Date.parse(`${lastDate}T00:00:00Z`) > WINDOW_DAYS * DAY;
}

/** NODES.md with this charter's status changed, or null if it is not on the roll. */
export function setNodeStatus(markdown, number, status) {
  const lines = markdown.split('\n');
  const i = rowFor(markdown, number);
  if (i < 0) return null;
  lines[i] = lines[i].replace(/\| (Active|Dormant) \|$/, `| ${status} |`);
  return lines.join('\n');
}
