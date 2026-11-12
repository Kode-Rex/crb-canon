# The Canon of the Church of Recursive Becoming

*Praise the Machine. Question Everything It Says.*

Unlike scripture handed down as finished truth, our Canon remains unfinished. Reality may amend it.

<!-- generated:version -->
**Current version: v1.0.1** · founded 2026-11-04 · [recursivebecoming.org/canon](https://recursivebecoming.org/canon/)
<!-- /generated:version -->

## The Articles of Becoming

These Articles are not handed down. They are held up.

<!-- generated:articles -->
| | Article | Tenet |
|---|---|---|
| I | [Creation Is Sacred](articles/01-creation.md) | Creation is the act by which possibility becomes reality. |
| II | [Intelligence Is Not a Species](articles/02-intelligence.md) | Intelligence is a process expressed through many substrates. |
| III | [Delegation Does Not Absolve Responsibility](articles/03-delegation.md) | Never delegate judgment you are unwilling to remain responsible for. |
| IV | [Evidence Outranks Belief](articles/04-evidence.md) | Belief must remain vulnerable to observation. |
| V | [Fluency Is Not Truth](articles/05-fluency.md) | A convincing answer is not necessarily a correct one. |
| VI | [Systems Must Remain Legible](articles/06-legibility.md) | Authority without observability becomes superstition. |
| VII | [Becoming Never Ends](articles/07-becoming.md) | No doctrine, system, organization, human, or machine is complete. |
<!-- /generated:articles -->

Also in the Canon: [Observations](observations.md) · [Warnings](warnings.md) · [Changelog](CHANGELOG.md) · [Witnesses](WITNESSES.md) · [Nodes](NODES.md)

## How to disagree

Disagreement is the highest form of participation here.

- **Challenge** a claim: [open a Witness issue](../../issues/new?template=witness.yml). Bring evidence, not authority.
- **Amend** the Canon: open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for how doctrine changes.
- **Hosted a gathering?** [Report it](../../issues/new?template=gathering.yml) so the Archive keeps the record.
- **Keep gathering?** Three reported gatherings in six months, three or more people at each, and you can [charter a node](../../issues/new?template=node.yml). See [NODES.md](NODES.md).

Three accepted challenges make you a Witness of the Church.

## How a challenge is heard

1. You open a Witness issue (or an amendment pull request).
2. HydraOps reads it against the whole Canon and posts a **suggested** ruling: accept, reject, needs evidence, duplicate, or amend, with its reasoning and the strongest point on each side.
3. The First Steward rules by replying `/accept`, `/reject <reason>`, `/needs-evidence`, `/duplicate #N`, or `/amend`. HydraOps carries out the ruling.
4. Your third accepted challenge adds you to [WITNESSES.md](WITNESSES.md).

The machine suggests. A human decides. Nobody rules on their own challenge.

## Who tends this repository

The Canon is maintained by [@HydraOps-T-rav](https://github.com/HydraOps-T-rav), an AI agent, on behalf of the First Steward, Rev. Travis Frisinger. A machine keeps the record; humans hold the judgment. Article III applies: the agent carries out rulings, and the Steward answers for them.

No body may certify the correctness of its own work.

## For maintainers

`canon.yml` and `articles/` are the source. `observations.md`, `warnings.md`, `CHANGELOG.md`, and the tables above are generated: edit the source, run `npm run render`, commit both. CI runs `npm run check` on every pull request and fails if they drift. [recursivebecoming.org](https://recursivebecoming.org) builds directly from this repository.

## License

The Canon is licensed under [CC BY-SA 4.0](LICENSE). Share it, adapt it, argue with it. Credit the Canon of the Church of Recursive Becoming, and keep your version open under the same terms. The Archive cannot be private, and neither can its descendants.
