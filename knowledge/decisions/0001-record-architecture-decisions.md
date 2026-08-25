# 0001 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

Decisions made during Phase 1 (project layout, contract strategy, tooling) will
constrain everything built afterwards. Without a record, the reasoning is lost
and future contributors either re-litigate settled questions or undo them by
accident.

## Decision

Every non-obvious, hard-to-reverse decision gets an ADR in
`knowledge/decisions/`, numbered sequentially. ADRs are immutable once merged; a
change of course is a new ADR that supersedes the old one.

## Consequences

- Small, ongoing cost per decision.
- Onboarding reads as a narrative rather than an archaeology exercise.
- Superseded ADRs stay in the tree as history, marked `Superseded by NNNN`.
