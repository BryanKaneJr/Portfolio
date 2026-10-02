# Return Man

A kick-return football game. You field the kickoff and try to take it to the house. Every return earns coins, and you spend them to make your returner faster, shiftier and harder to bring down.

It plays in 3D from a third-person camera behind the returner, looking downfield into a night-game stadium. It's a single `index.html` with no build step. The only dependency is [three.js](https://threejs.org/) r128, loaded from cdnjs. Open it in a browser and play. It works with a keyboard or with touch.

## Controls

| Control | Touch | Keyboard |
| --- | --- | --- |
| Steer | Drag the center joystick | WASD / arrow keys |
| Hurdle | ▲ button | I (or Space) |
| Roll left / right | ◀ / ▶ buttons | J / L (or Q / E) |
| Jump back | ▼ button | K (or C) |
| Kneel for a touchback | Kneel button (end zone only) | N |
| Pause | II button | Esc / P |

When you release the joystick, the returner coasts to a stop instead of halting. You can lift your thumb, tap a move and grab the stick again without losing your run. A move holds your momentum while it plays and hands it back when it ends.

## How a play works

1. **The kick.** The ball is kicked from the 35. A gold ring marks where it lands. Get under it to catch it. If you miss, the ball is loose and the coverage team will try to fall on it. Kicks come in three kinds: deep, short, and (from week 4) squib kicks that bounce along the ground.
2. **The return.** Eleven defenders run down in lanes: two fast gunners, the coverage team, a safety who hangs back, and a slow kicker as the last line. Your eight blockers set up a wall and take on whoever threatens you most.
3. **Tacklers lunge.** A defender who gets close flashes a red **!** and then dives at where you are right now. Roll, hurdle or jump back during the **!** and he hits the turf. If you're caught flat-footed, your Strength decides whether you break the tackle.
4. **The play ends** on a touchdown, a tackle, stepping out of bounds, a safety in your own end zone, or a fumble the coverage team recovers.

Each move costs energy from the bar under your feet, so you can't spam them. Energy refills while you run.

## Season mode

- 16 weeks plus 4 playoff rounds. Each game is **3 kicks**.
- You win a game by reaching a field-position goal over the 3 kicks. A touchdown counts as 100. The goal and the coverage team's speed, pursuit angles and tackling both rise every week.
- Win the title game and a new season starts, with faster coverage and bigger rewards. You keep every upgrade.
- A loss costs nothing but time. You keep the coins and run it back.

## Coins

- 1 coin per return yard
- Style bonuses: **Hurdled** +15, **Ankles broken** +12, **Jump cut** +12, **Broken tackle** +15
- Touchdown bonus, which grows with difficulty
- Win bonus, worth 1.5× in the playoffs

## Upgrades (10 levels each)

| Upgrade | What it does |
| --- | --- |
| Speed | Top speed |
| Burst | Acceleration back to full speed after cuts and moves |
| Agility | Sharper cuts, shorter recovery between moves |
| Roll | Roll distance |
| Hurdle | Hang time and a cleaner landing |
| Jump Back | Jump-back distance |
| Energy | Bigger energy bar, faster refill |
| Strength | Chance to break a tackle |
| Vision | Camera sits higher and farther back so you see more. Level 3 flags tacklers about to lunge; level 6 draws their pursuit angles |
| Blocking | Blockers get there faster and hold longer |

The **Locker room** sells jerseys as a coin sink once your stats are high.

## Ideas for later

- **Return-team play calls** before each kick: a middle wedge, a sideline return or a reverse, each moving where the blocking wall sets up.
- **Weather**: wind that pushes the kick off its marker, and rain that adds fumble risk on the catch.
- **Daily challenge kick** with a fixed seed and a leaderboard.
- **Punt returns**: shorter field and gunners who arrive faster, plus the fair-catch decision.
- **Highlight replay** of the last touchdown, built from recorded positions.
- **Returner archetypes** (speedster, bruiser, shifty) that start with different stat spreads.
