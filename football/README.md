# Touchline Football

Realistic 2D top-down 11v11 football for mobile (Godot 4.3+, GDScript).

> Phase 1 skeleton: a stub match runs with placeholder physics/AI/rules. The full README
> (Android export, controls, structure, known issues) is completed in Phase 4.

## Run (desktop)
1. Install Godot **4.3** (standard build, not .NET).
2. Open `football/project.godot` in the editor and press F5, or from a shell:
   `godot --path football`
3. Keyboard: WASD/arrows move, J pass/tackle, K through/slide, L shoot (hold)/switch, I skill/press, Shift sprint, Q switch, Esc pause.

## Tests (headless)
```
godot --headless --path football --import          # first time only
godot --headless --path football res://tests/test_runner.tscn
```

## Docs
- `docs/SPEC.md` — architecture, interfaces, conventions (read first)
- `docs/REQUESTS.md` — interface change requests
- `docs/BUGS.md` — bug reports
