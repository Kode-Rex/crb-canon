import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formField, referencedIssues, readGathering, checkCharter, cleanCell, addNode, setNodeStatus, parseNodes, isLapsed } from './nodes.mjs';

test('parseNodes reads the rows addNode writes; isLapsed uses the six-month window', () => {
  const head = '| Node | Where | Steward | Chartered | Status |\n|---|---|---|---|---|\n';
  const md = addNode(head, { name: 'N', city: 'C', steward: 'a-b', date: '2026-01-02', number: 3, repo: 'o/r' });
  assert.deepEqual(parseNodes(setNodeStatus(md, 3, 'Dormant')), [{ number: 3, steward: 'a-b', chartered: '2026-01-02', status: 'Dormant' }]);
  assert.equal(isLapsed('2026-05-15', new Date('2026-11-06')), false);
  assert.equal(isLapsed('2026-04-01', new Date('2026-11-06')), true);
});

const report = (number, { date = '2026-11-01', people = '4', author = 'host', label = 'gathering' } = {}) => ({
  number,
  user: { login: author },
  labels: [{ name: label }],
  body: `### Date\n\n${date}\n\n### City or node\n\nDuluth\n\n### How many people\n\n${people}\n\n### The Observation\n\nX`,
});
const today = new Date('2026-11-06T12:00:00Z');
const check = (issues, applicant = 'host') => checkCharter({ applicant, gatherings: issues.map(readGathering), today });

test('formField reads issue-form answers and treats "_No response_" as empty', () => {
  const body = '### Node name\n\nNode Duluth\n\n### Public contact\n\n_No response_\n';
  assert.equal(formField(body, 'Node name'), 'Node Duluth');
  assert.equal(formField(body, 'Public contact'), '');
  assert.equal(formField(body, 'Missing'), '');
});

test('referencedIssues finds #N and issue URLs once each', () => {
  assert.deepEqual(referencedIssues('#4, #9 and https://github.com/a/b/issues/12 and #4'), [4, 9, 12]);
});

test('three good reports on different days meet the bar', () => {
  const r = check([report(1, { date: '2026-09-01' }), report(2, { date: '2026-10-01' }), report(3, { date: '2026-11-01' })]);
  assert.equal(r.counted, 3);
  assert.equal(r.meets, true);
});

test('each failure is named and does not count', () => {
  const r = check([
    report(1, { people: '2' }),
    report(2, { author: 'someone-else' }),
    report(3, { date: '2026-04-01' }),
    report(4, { date: '2026-12-25' }),
    report(5, { label: 'witness' }),
    report(6, { date: 'soon' }),
  ]);
  assert.equal(r.counted, 0);
  assert.equal(r.meets, false);
  assert.deepEqual(
    r.rows.map((x) => x.problems[0]),
    ['fewer than 3 people', 'reported by someone else', 'more than six months ago', 'dated in the future', 'not a gathering report', 'no date'],
  );
});

test('two reports for the same day count once', () => {
  const r = check([report(1), report(2), report(3, { date: '2026-10-01' })]);
  assert.equal(r.counted, 2);
  assert.equal(r.rows[1].problems[0], 'same day as another report');
});

test('missing reports are named', () => {
  const r = checkCharter({ applicant: 'host', gatherings: [{ number: 99, missing: true }], today });
  assert.deepEqual(r.rows[0].problems, ['no such report']);
});

test('cleanCell strips anything that could break the table or ping someone', () => {
  assert.equal(cleanCell('Node | <b>@everyone</b> [x](y)'), 'Node b everyone /b x y');
});

test('addNode appends once; setNodeStatus flips the status', () => {
  const head = '| Node | Where | Steward | Chartered | Status |\n|---|---|---|---|---|\n';
  const one = addNode(head, { name: 'Node Duluth', city: 'Duluth, MN', steward: 'host', date: '2026-12-15', number: 7, repo: 'o/r' });
  assert.match(one, /\| \[Node Duluth\]\(https:\/\/github.com\/o\/r\/issues\/7\) \| Duluth, MN \| \[@host\]\(https:\/\/github.com\/host\) \| 2026-12-15 \| Active \|/);
  assert.equal(addNode(one, { name: 'Again', number: 7, steward: 'host', date: 'x', repo: 'o/r' }), null);
  assert.match(setNodeStatus(one, 7, 'Dormant'), /\| Dormant \|/);
  assert.equal(setNodeStatus(one, 70, 'Dormant'), null);
});
