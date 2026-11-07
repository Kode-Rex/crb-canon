// Minimal GitHub REST client for the Witness workflows. Runs inside GitHub Actions.
import { readFileSync } from 'node:fs';

const API = 'https://api.github.com';

export function env(name, fallback) {
  const value = process.env[name] || fallback;
  if (value === undefined) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const DRY_RUN = process.env.DRY_RUN === '1';
export const repo = () => env('GITHUB_REPOSITORY');
export const steward = () => env('STEWARD', 'T-rav');
export const event = () => JSON.parse(readFileSync(env('GITHUB_EVENT_PATH'), 'utf8'));

export async function gh(method, path, body) {
  const writes = method !== 'GET';
  if (DRY_RUN && writes) {
    console.log(`[dry run] ${method} ${path}`, body ? JSON.stringify(body, null, 2) : '');
    return {};
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'crb-canon-witness',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export const comment = (number, body) => gh('POST', `/repos/${repo()}/issues/${number}/comments`, { body });
export const addLabels = (number, labels) => gh('POST', `/repos/${repo()}/issues/${number}/labels`, { labels });
export async function removeLabel(number, name) {
  try {
    await gh('DELETE', `/repos/${repo()}/issues/${number}/labels/${encodeURIComponent(name)}`);
  } catch (e) {
    if (!String(e).includes('-> 404')) throw e;
  }
}
export const closeIssue = (number, state_reason = 'completed') =>
  gh('PATCH', `/repos/${repo()}/issues/${number}`, { state: 'closed', state_reason });
export const react = (commentId, content) =>
  gh('POST', `/repos/${repo()}/issues/comments/${commentId}/reactions`, { content });

/** Labels the Witness process uses. Created on first use so a fresh fork works. */
export const LABELS = {
  'suggested:accept': ['8FA89A', 'HydraOps suggests accepting. The Steward decides.'],
  'suggested:reject': ['5E5B55', 'HydraOps suggests rejecting. The Steward decides.'],
  'suggested:needs-evidence': ['B89B6A', 'HydraOps suggests asking for evidence. The Steward decides.'],
  'suggested:duplicate': ['C9C4B8', 'HydraOps suggests this duplicates another challenge.'],
  'suggested:amend': ['C97B52', 'HydraOps suggests this should become an amendment.'],
  accepted: ['C97B52', 'Challenge accepted by the Steward. Counts toward Witness.'],
  rejected: ['0E0E0E', 'Challenge heard and rejected.'],
  'needs-evidence': ['B89B6A', 'Bring evidence, not authority.'],
  duplicate: ['C9C4B8', 'Already being heard elsewhere.'],
  amendment: ['0E0E0E', 'A proposed change to the Canon.'],
  'adoption-approved': ['8FA89A', 'Steward approves adoption once the debate period ends.'],
  witness: ['C97B52', 'A challenge to a claim. Bring evidence.'],
  gathering: ['8FA89A', 'A report from an Assembly gathering.'],
  'self-organized': ['C97B52', 'A gathering its host organized without the Founder. Counts for the pre-registration.'],
  'node-charter': ['0E0E0E', 'A request to charter a local node.'],
  chartered: ['8FA89A', 'Charter accepted. The node is on the roll in NODES.md.'],
};

export async function ensureLabels(names) {
  for (const name of names) {
    const [color, description] = LABELS[name] ?? ['C9C4B8', ''];
    try {
      await gh('POST', `/repos/${repo()}/labels`, { name, color, description });
    } catch (e) {
      if (!String(e).includes('-> 422')) throw e; // 422: already exists
    }
  }
}

/** A repository file's text and sha, for read-modify-write through the contents API. */
export async function readRepoFile(path) {
  const file = await gh('GET', `/repos/${repo()}/contents/${path}`);
  return { text: Buffer.from(file.content ?? '', 'base64').toString('utf8'), sha: file.sha };
}
export const writeRepoFile = (path, text, sha, message) =>
  gh('PUT', `/repos/${repo()}/contents/${path}`, { message, content: Buffer.from(text).toString('base64'), sha });

/** How many of this person's challenges the Steward has accepted. */
export async function acceptedCount(login) {
  const issues = await gh('GET', `/repos/${repo()}/issues?state=all&labels=accepted&creator=${encodeURIComponent(login)}&per_page=100`);
  return issues.filter((i) => !i.pull_request).length;
}

/** Optional ping outside GitHub: Slack reads `text`, Discord reads `content`. */
export async function notify(text) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url || DRY_RUN) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text, allowed_mentions: { parse: [] } }) });
  } catch (e) {
    console.warn(`Notify webhook failed: ${e}`);
  }
}
