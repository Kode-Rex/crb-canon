// Mark nodes Dormant after six months without a reported gathering. Runs weekly.
// A node's last sign of life is its newest gathering report by its Steward, or its charter date.
// Local dry run: DRY_RUN=1 GITHUB_REPOSITORY=Kode-Rex/crb-canon GITHUB_TOKEN=... node scripts/sweep-nodes.mjs
import { gh, repo, readRepoFile, writeRepoFile, DRY_RUN } from './lib/github.mjs';
import { parseNodes, readGathering, isLapsed, setNodeStatus } from './lib/nodes.mjs';

const roll = await readRepoFile('NODES.md');
let text = roll.text;
const lapsed = [];

for (const node of parseNodes(text).filter((n) => n.status === 'Active')) {
  const reports = await gh('GET', `/repos/${repo()}/issues?state=all&labels=gathering&creator=${encodeURIComponent(node.steward)}&per_page=100`);
  const dates = reports.map(readGathering).map((g) => g.date).filter(Boolean);
  const last = [node.chartered, ...dates].sort().at(-1);
  if (isLapsed(last)) {
    text = setNodeStatus(text, node.number, 'Dormant');
    lapsed.push(`#${node.number} (last ${last})`);
  }
}

if (lapsed.length) {
  await writeRepoFile('NODES.md', text, roll.sha, `Mark dormant: ${lapsed.join(', ')}`);
  console.log(`${DRY_RUN ? '[dry run] ' : ''}Dormant: ${lapsed.join(', ')}`);
} else {
  console.log('Every active node has gathered in the last six months.');
}
