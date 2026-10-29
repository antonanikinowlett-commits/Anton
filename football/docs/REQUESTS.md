# Interface Change Requests

Append requests here instead of editing files outside your folder. The orchestrator
reviews them during integration and marks each one `ACCEPTED (commit)`, `REJECTED (reason)` or `DONE`.

Template:

```
### [module] Short title
- What: exact change (file, member, signature)
- Why: gameplay/perf reason
- Workaround in the meantime: ...
- Status: OPEN
```

---

### [tactics] Resolve away-kit clash when a match is built
- What: in `FootballMatch.setup` (or UI before building `MatchConfig`), call `TacTeamLibrary.resolve_away_kit(home_data, away_data)` (static, mutates the away `TeamData` colours when the primaries clash).
- Why: SPEC §9 says TACTICS provides the helper and the caller applies it; players are coloured from `TeamData.color_primary` in `Player.setup`.
- Workaround in the meantime: none needed for play; kits may look alike for some pairings.
- Status: OPEN

### [tactics] Pre-match formation change must reorder the squad
- What: when the UI changes `TeamData.tactics.formation_id` before a match, call `TacFormationUtils.arrange_squad(team_data, formation_id)` so `squad[0..10]` matches the new slot roles (Team.setup maps squad[i] to slot i). During a match use `TacFormationUtils.change_formation(team, id)` (remaps `slot_index` / `role` of existing Player nodes; keeps node identity).
- Why: `Team.setup` assigns `starting_xi()[i]` to formation slot i; a mismatch puts e.g. a striker in the LB slot.
- Workaround in the meantime: use only the team's own formation, or call the helpers above from UI.
- Status: OPEN

### [tactics] Set-piece contract notes for RULES/AI
- What: call `team.shape.get_set_piece_position(p, restart)` (cheap, cached ~0.5 s, recomputed when restart type/spot/taker changes) and `team.shape.pick_set_piece_taker(restart)`; the Referee should assign `restart.taker` from it. `restart.wall_distance` (9.15) is honoured for walls.
- Why: documentation of the contract; no core change required.
- Status: OPEN (informational)
