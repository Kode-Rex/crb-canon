// Carry out the Steward's ruling, given as a slash command in an issue or PR comment.
//   /accept  /reject <reason>  /needs-evidence  /duplicate #N  /amend  /retriage
// Only the Steward or a repo admin/maintainer may rule, and nobody rules on their own submission.
import { gh, repo, steward, event, comment, addLabels, removeLabel, ensureLabels, closeIssue, react, acceptedCount, DRY_RUN } from './lib/github.mjs';
import { triage } from './triage.mjs';

const WITNESS_THRESHOLD = 3;
const SUGGESTED = ['accept', 'reject', 'needs-evidence', 'duplicate', 'amend'].map((s) => `suggested:${s}`);
const SIGNOFF = '\n\n<sub>Ruled by the Steward, carried out by HydraOps.</sub>';

async function mayRule(login) {
  if (login === steward()) return true;
  try {
    const { permission } = await gh('GET', `/repos/${repo()}/collaborators/${encodeURIComponent(login)}/permission`);
    return permission === 'admin' || permission === 'maintain';
  } catch {
    return false;
  }
}

async function clearSuggestions(number) {
  for (const label of [...SUGGESTED, 'needs-evidence']) await removeLabel(number, label);
}

async function recognizeWitness(login, number) {
  const path = 'WITNESSES.md';
  const file = await gh('GET', `/repos/${repo()}/contents/${path}`);
  const current = Buffer.from(file.content ?? '', 'base64').toString('utf8');
  if (current.includes(`[@${login}]`)) return false;
  const date = new Date().toISOString().slice(0, 10);
  const updated = `${current.trimEnd()}\n| [@${login}](https://github.com/${login}) | ${date} · third accepted challenge, #${number} |\n`;
  await gh('PUT', `/repos/${repo()}/contents/${path}`, {
    message: `Recognize @${login} as a Witness (#${number})`,
    content: Buffer.from(updated).toString('base64'),
    sha: file.sha,
  });
  return true;
}

async function accept(issue, { amend = false } = {}) {
  const n = issue.number;
  await clearSuggestions(n);
  if (issue.pull_request) {
    await ensureLabels(['adoption-approved']);
    await addLabels(n, ['adoption-approved']);
    await comment(n, `**Approved for adoption** once the debate period ends. Merge it then, bump the version in \`canon.yml\`, and run \`npm run render\`.${SIGNOFF}`);
    return;
  }
  await ensureLabels(['accepted', ...(amend ? ['amendment'] : [])]);
  await addLabels(n, ['accepted', ...(amend ? ['amendment'] : [])]);
  const author = issue.user.login;
  const count = (await acceptedCount(author)) + (DRY_RUN ? 1 : 0);
  let note = `Challenge **accepted**. @${author}, that is ${count} accepted challenge${count === 1 ? '' : 's'}.`;
  if (count >= WITNESS_THRESHOLD && (await recognizeWitness(author, n))) {
    note += ` That makes you a **Witness of the Church**. Your name is on the roll in [WITNESSES.md](../blob/main/WITNESSES.md).`;
  } else if (count < WITNESS_THRESHOLD) {
    note += ` ${WITNESS_THRESHOLD - count} more to become a Witness.`;
  }
  if (amend) note += `\n\nThe Canon should change. Open a pull request against \`canon.yml\` or \`articles/\` that references #${n}; it will be assigned a Witness and debated.`;
  await comment(n, note + SIGNOFF);
  if (!amend) await closeIssue(n, 'completed');
}

async function run() {
  const e = event();
  const body = (e.comment?.body ?? '').trim();
  const [cmd, ...rest] = body.split(/\s+/);
  const arg = rest.join(' ').trim();
  const issue = e.issue;
  const login = e.comment.user.login;
  const known = ['/accept', '/reject', '/needs-evidence', '/duplicate', '/amend', '/retriage'];
  if (!known.includes(cmd)) return console.log(`Not a ruling: ${cmd}`);

  if (!(await mayRule(login))) {
    await react(e.comment.id, 'confused');
    return console.log(`${login} may not rule; ignoring ${cmd}.`);
  }
  if (login === issue.user.login && cmd !== '/retriage') {
    await comment(issue.number, `@${login}, you cannot rule on your own submission. No body may certify the correctness of its own work.`);
    return;
  }

  const n = issue.number;
  switch (cmd) {
    case '/accept':
      await accept(issue);
      break;
    case '/amend':
      await accept(issue, { amend: true });
      break;
    case '/reject':
      await clearSuggestions(n);
      await ensureLabels(['rejected']);
      await addLabels(n, ['rejected']);
      await comment(n, `Heard and **rejected**${arg ? `: ${arg}` : '.'}\n\nThe Canon thanks you for the contradiction. Disagreement is the highest form of participation here, and a rejected challenge can be reopened with new evidence.${SIGNOFF}`);
      await closeIssue(n, 'not_planned');
      break;
    case '/needs-evidence':
      await clearSuggestions(n);
      await ensureLabels(['needs-evidence']);
      await addLabels(n, ['needs-evidence']);
      await comment(n, `**Needs evidence**${arg ? `: ${arg}` : '.'} The point may be right. Evidence outranks belief (Article IV): add it here and the Steward will rule again.${SIGNOFF}`);
      break;
    case '/duplicate': {
      const target = /#?(\d+)/.exec(arg)?.[1];
      if (!target) {
        await comment(n, 'Usage: `/duplicate #N`');
        break;
      }
      await clearSuggestions(n);
      await ensureLabels(['duplicate']);
      await addLabels(n, ['duplicate']);
      await comment(n, `Already being heard in #${target}. Add your argument there.${SIGNOFF}`);
      await closeIssue(n, 'not_planned');
      break;
    }
    case '/retriage':
      await triage(n);
      break;
  }
  await react(e.comment.id, '+1');
}

await run();
