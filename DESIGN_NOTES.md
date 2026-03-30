# Table Soccer — Design Notes

## Core Mechanic

Always 3 coins. No ball. Always refer to them as **coins**.

- **Kickoff:** kicked coin must hit at least one of the other two coins, or it is a foul.
- **Normal play:** kicked coin must pass *between* the other two coins — crossing the line (gate) between them makes the kick legal.

The gate mechanic is the defining feature of the game. Positioning all three coins matters every turn, not just where the kicked one ends up.

---

## Level Types

### Match
Symmetric field, two goals. Soccer-style — race to score goals.

- Turn-by-turn: board rotates 180° for local handover so each player always attacks the top goal.
- Networked: board stays static, goal always at top for each player on their own screen.
- First to 3 goals wins (configurable).

### Course
Asymmetric obstacle course. A challenge of accuracy and clever coin placement.

- Start position → goal (single target).
- Fouls = return to start (or last checkpoint).
- Checkpoints possible — save position mid-course.
- Timer = score (lower is better).
- Same 3-coin gate mechanic applies throughout.
- Obstacles: narrow passages, awkwardly placed blockers, teleport requirements, etc.

---

## Game Modes

| Mode | Level Type | Notes |
|---|---|---|
| Single Player | Course | Solo puzzle / challenge levels |
| Single Player vs AI | Match | Simple AI opponent |
| Two Player (same machine) | Course | Race — both attempt same course, compare timers |
| Two Player Mouse Handover | Match | Current implementation |
| Two Player Networked | Match | Future |

### AI

Initial AI: look 2 moves ahead, bias toward goal. No blocking, no trick shots.
Keep ML upgrade path open — this game could make an interesting ML test later.

---

## Foul Conditions

### Match
- Kicked coin does not pass between the other two (gate not crossed).
- Coins stay where they are; turn passes to opponent.

### Course
- Kicked coin does not cross the gate (same mechanic).
- Additional foul modes to add later: coin exits through a hole in the wall (falls to infinity).
- Foul penalty = return to start (or last checkpoint).

---

## Level Primitives

### Planned (full set)
- **Goal(s)** — entry/exit trigger zones (placeable, not hardcoded top/bottom)
- **Boundary walls** — arbitrary polyline perimeter
- **Blockers** — solid interior obstacles (polygon surrounded by walls)
- **Bouncers** — like walls but restitution > 1 (add energy on bounce)
- **Teleports** — paired portals; coin exits one and enters the other

### Build Order
1. Arbitrary polyline boundaries + interior blockers (replace current ngon system)
2. Level designer UI — boundary walls and blockers first
3. Placeable goals (decouple from field shape)
4. Bouncers and teleports after the above is solid

---

## Level Format

Levels are JSON data. Rough schema:

```json
{
  "type": "match" | "course",
  "boundary": [[x, y], [x, y], ...],
  "blockers": [
    { "verts": [[x, y], ...] }
  ],
  "goals": [
    { "from": [x, y], "to": [x, y], "scorer": "p1" }
  ],
  "start": [[x, y], [x, y], [x, y]],
  "checkpoints": [
    { "from": [x, y], "to": [x, y] }
  ]
}
```

Level designer writes this format; game engine reads it.

---

## Level Designer

In-game or separate HTML tool — whichever ships faster.

**First iteration:** boundary walls and blockers only.
**Later:** goals, bouncers, teleports.

---

## Physics / Wall Ideas

- **Bouncier walls** — walls already at `restitution: 1` (perfectly elastic). Coins with `restitution > 1` would add energy on bounce — snappy bank shots.
- **Spring walls** — force impulse on contact rather than just elastic reflection.
- **Gaps** — holes in the boundary. Coin exits = foul, or coin is removed from play.
- **Teleport portals** — paired openings. Strong visual opportunity with the electric aesthetic.

---

## Visual / Effects Direction

- Electric effects are a strong part of the identity — extend these wherever possible.
- Neon/Tron aesthetic throughout.
- Portal entry/exit would suit the electric visual language well.
