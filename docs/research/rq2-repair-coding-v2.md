# RQ2 repair coding v2 (schema 5)

## Purpose
The existing session-level `childRepairCount` is a surface marker count and is not treated as the formal RQ2 REP code. Formal repair coding uses the local sequence (previous AI turn → child turn → following AI turn), AI candidate coding, and human confirmation.

## Formal representation
- Reference basis: B4 when the child adapts to the AI's comprehension/trouble state.
- Interaction function: REP when the child repairs/replaces a prior own utterance.
- Repair subtype: `self_initiated`, `response_to_trouble`, `third_position`.
- Outcome: `resolved`, `unresolved`, `unclear`.
- Technology involvement: `probable`, `possible`, `not_evident`, `unclear`. The log does not justify claiming ASR as a certain cause.

## Third-position example
Child: I play for tonight. → AI: Okay, have fun playing tonight! → Child: No no. I play Fortnite. → AI: Oh, Fortnite!

This is coded as B4 + REP + `third_position`; outcome is `resolved`. Technology involvement must be judged separately.

## Candidate audit
The repair candidate audit is recall-oriented and may contain false positives. Candidate status never becomes a formal REP code without the normal RQ2 human-confirmation process.
