# Code review — automate-skill-discipline F0 (local)

**mode:** local (automate phase-done defaults to both; external leg: host=grok — see cross-model note)  
**range:** 4f6abe7..42ed863f4cccf2e0e92d0362bcc3bbfbc9d03817  
**verdict:** approve_with_nits  
**reviewedAt:** 2026-07-21T19:41:46Z

## Summary
F0 lands Layer-2 `assert-automate-gate.js` wrapping pure orchestrator gates + skill prose HARD-GATEs at C/E/G/I. 16 tests pass. Pure-maestro dogfood used this CLI for done + phase-done successfully.

## Findings

### F-001 [nit] --check-reachability requires separate --reachable-file
**Claim:** CLI rejects bare --check-reachability without --reachable-file.  
**Impact:** Agents must compute ancestors then pass file — friction but fail-closed.  
**Disposition:** accept (document in handoff; F3 cursor may ease).

### F-002 [nit] project-transitions "prefer assert" vs must
**Claim:** archive/finalize path softens language vs implement pure-maestro.  
**Impact:** Low — still requires exit 0 for HARD-FAIL equivalence.  
**Disposition:** defer to F4 framing polish.

## Self-review
- G1: applied — verifiers re-run post-merge; claim report validated  
- G2: applied — verdicts are approve_with_nits + evidence  
- G6: applied — paths/SHAs verbatim  

## Cross-model / both note
External family-different leg for phase-done both: deferred to operator if codex unavailable this session; reviewGate records mode and SHA. Automate design allows recorded disposition.
