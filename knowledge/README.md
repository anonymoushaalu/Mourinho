# Knowledge

Durable, human-authored context about Mourinho: domain rules, decisions, and
external facts that the code cannot express on its own.

## What belongs here

| Folder        | Contents                                               |
| ------------- | ------------------------------------------------------ |
| `domain/`     | Vocabulary, entities, invariants, business rules.      |
| `decisions/`  | Architecture Decision Records — one file per decision. |
| `references/` | External specs, third-party API notes, research links. |

## Rules

1. **Code is the source of truth for behaviour.** If a note contradicts the
   code, the code wins and the note is stale — fix or delete it.
2. **One idea per file**, named in kebab-case, with a title and a date.
3. **Decisions are append-only.** Never rewrite an ADR; supersede it with a new
   one and link the two. The reasoning that was true then is still worth
   knowing.
4. **No secrets.** This folder is committed.

## Why a folder rather than a wiki

It versions with the code, is reviewed in the same pull request that changes the
behaviour, and is greppable by both people and tooling. A wiki drifts because
nothing forces it to change when the code does.
