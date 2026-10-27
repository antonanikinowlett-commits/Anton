# Workstream 5 — AI (`ws/ai`)
Owns `js/sim/ai.js`, `tools/debug_sim.html`.

Goals
1. Strategic AI: pick war goals by value/risk, build coalitions, time wars around rivals' other wars, respect truces, sue for peace sensibly, honour alliances.
2. Military AI: use fronts and battle plans, concentrate force, siege priority, retreat & regroup, naval transport, hire mercenaries.
3. Economy/politics AI: build order by province value, laws & focus choice by personality, manage estates to avoid revolts.
4. Personalities (aggressive, builder, schemer, zealot) per ruler; historical behaviour for key realms (Mongols 1220s+, Crusade 1202–04, Reconquista).
5. Metrics in debug_sim: borders after 50 years should look plausible — no single realm > 3× its start, few blobs.
Constraints: AI tick cost must stay small (stagger nations across days). Every new player tool from other workstreams must get AI support.
