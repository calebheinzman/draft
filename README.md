# All-In — Draft Order Card Game

A tiny, zero-dependency browser game for settling a fantasy football **draft
order**. Each drafter takes a turn drawing a card; number cards drop them into a
draft slot, and special cards cause chaos. Last one standing gets shuffled into
whatever's left.

Open `index.html` in any browser — there's no build step and no backend.

## Sync from Sleeper

Instead of typing every manager's name, paste a **Sleeper league ID or
username** into the *Sync from Sleeper* box and hit **Sync League**:

- A **league ID** loads that league's members directly.
- A **username** (or user ID) looks up the leagues that account is in for the
  current NFL season. If there's exactly one it loads it; if there are several
  you get a button per league to choose from.
- Tick **add to existing players** to append the league to whoever's already in
  the list instead of replacing them.

This uses Sleeper's public, read-only REST API (`/v1/league/...`,
`/v1/user/...`) straight from the browser — no API key, no login, nothing
stored. Member names come from each user's Sleeper display name (falling back to
team name).

## Sitting out

Not everyone wants to play the card game. Before the draft starts, the roster
appears as a row of chips under **Who's playing?** — tap anyone who isn't
drafting, then hit **Start Draft**.

Each person sitting out is dealt a **random draft slot**, anywhere from 1 to N,
and is **locked** into it. A locked slot is out of the game entirely: no card can
move that person, and nobody else can be placed there. The board shows those
cells dashed and gold with a 🔒, and the roll is written into the ledger so the
room can see it happened once, up front, at random.

The rest of the league then plays for whatever slots are left. Everything scales
down accordingly — a 12-person league with 6 sitting out plays much like a
6-person draft.

Marking sit-outs is a setup-only step, since the slot roll has to happen once
against a final roster. **Reset** returns to setup (keeping the same people
marked out) and re-rolls; re-syncing from Sleeper does the same.

## The cards

Number cards place the drawer into that draft slot, bumping whoever's there.
Only unlocked slots are dealt as number cards, so you can never draw your way
into somebody's locked spot. The special cards:

| Card | Effect |
| --- | --- |
| **King** — *Coup* | Take slot 1; anyone there is knocked back into the queue. If slot 1 is locked, take the best slot that isn't. |
| **Queen** — *Patience* | Slot in right behind the current first player. |
| **Jack** — *Trailer* | Slot in right behind the last placed player. |
| **Joker** — *Choice* | Pick any open slot you like. |
| **Ace** — *Pass* | Skip your turn — draw again later. |
| **Mirror** — *Reverse* | Flip the board order; you draw again. Locked slots stay put and the rest reverse around them. |
| **Bomb** — *Boom* | Everyone off the board and back into the queue; you go again. |
| **Nuke** — *Fallout* | Like a Bomb, but the queue is reshuffled into random order. |
| **Cluster Bomb** — *Shrapnel* | A random half of the board is blown back into the queue; you go again. |

Locked slots survive all three resets — Queen and Jack still count a locked
player as "placed" when they look for the first or last one on the board.

### How explosive is it?

Bomb, Nuke and Cluster Bomb are the "resets". The deck is tuned so a draft runs
**3–5 resets on average** — enough scrambling to be worth watching, not so much
that nobody ever gets placed.

That holds no matter how many people are drafting. The deck is built from the
number of **drafters**, not the size of the league, so six people drafting play
the same game whether the other six are sitting out or were never in the league
at all. Measured over 15,000 simulated drafts each:

| Drafters | Reset cards in deck | Average resets | No resets at all | Reaches 10+ | Cards drawn |
| --- | --- | --- | --- | --- | --- |
| 2  | 19 | 4.1 | 5.1% | 6.5% | ~9 |
| 4  | 12 | 4.7 | 1.5% | 7.7% | ~16 |
| 6  | 9  | 4.3 | 2.5% | 1.3% | ~21 |
| 8  | 8  | 4.2 | 1.3% | 2.4% | ~26 |
| 10 | 7  | 3.9 | 2.5% | 2.0% | ~30 |
| 12 | 7  | 4.2 | 1.7% | 3.9% | ~37 |
| 14 | 7  | 4.5 | 2.0% | 5.5% | ~44 |
| 16 | 6  | 3.6 | 2.4% | 2.0% | ~43 |
| 20 | 6  | 3.9 | 2.3% | 3.1% | ~55 |

So a quiet draft still usually sees one or two explosions, and roughly one in
thirty goes properly off the rails.

The deck is three copies of every ordinary card (one per *open* slot, plus King,
Queen, Jack, Joker, Ace, Mirror) and a handful of reset cards — one Nuke, one
Cluster Bomb, the rest plain Bombs. The reset count shrinks as the draft grows:
a short draft has fewer draws to hide a bomb in and needs a denser deck to
average the same number of resets, while a long one needs a thinner deck or it
runs away. One reset card is dealt into the opening stretch of the deck —
without it, about one draft in seven would finish before any bomb turned up.

A one-person draft is the exception: it's over in about three draws, and there's
no order left to scramble.

These knobs interact sharply: a reset clears the board, which means more draws,
which means more resets. Run `node tools/simulate.mjs` after changing `DECK` in
`game.js`. The simulator also checks the locked-slot rules on every game it
plays: sit-outs must finish pinned where they started, never in the queue, and
every drafter must land on the board exactly once.

## Play it

Hosted on GitHub Pages: **https://calebheinzman.github.io/draft/**

Everything runs client-side. No accounts, no server, no data leaves the browser
except the read-only calls to Sleeper when you sync a league.

## Development

Run a live server locally:

```bash
npm run dev
```

This uses `live-server` via `npx` and automatically reloads when files change.

## Files

- `index.html` — markup and the Sleeper sync panel.
- `game.js` — the deck and all the game rules; no DOM, so it can be simulated.
- `index.js` — rendering and the sync handlers (loaded after `game.js`).
- `sleeper.js` — the Sleeper public-API client (loaded before `index.js`).
- `styles.css` — styling.
- `tools/simulate.mjs` — measures the reset distribution against the real rules.

## Credits

- Built by [Caleb Heinzman](https://github.com/calebheinzman), with
  [Claude Code](https://claude.com/claude-code) as a pair programmer.
- League sync is powered by the free, public
  [Sleeper API](https://docs.sleeper.com/). This project is not affiliated with,
  endorsed by, or sponsored by Sleeper — it just reads their public endpoints.
- The card game itself is a house rule that's been kicking around our league for
  years; this is only the version that stops arguments about whose turn it is.

Licensed under the [MIT License](LICENSE).
