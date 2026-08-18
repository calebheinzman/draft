// Measures how many resets an average game runs, against the real rules in
// game.js. Run with: node tools/simulate.mjs [trials]
//
// The deck is tuned for 3-5 resets on average, ~2% of games with none, and a
// natural tail where a few percent reach 10 or more. Re-run this after touching
// DECK in game.js — the knobs interact sharply, because a reset clears the
// board, which means more draws, which means more resets.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createGame, DECK } = require("../game.js");

const TRIALS = Number(process.argv[2]) || 40000;
const SIZES = [6, 8, 10, 12, 14, 16];

// Guards against a tuning mistake that makes games never terminate.
const DRAW_LIMIT = 100000;

function playOneGame(size, sitOuts = 0) {
  // The Joker asks a human for a spot; a random pick from what's open stands in.
  const game = createGame({
    chooseSpot: (_player, open) => open[Math.floor(Math.random() * open.length)],
  });
  game.seed(Array.from({ length: size }, (_, i) => `P${i + 1}`));
  for (let i = 0; i < sitOuts; i++) game.setSitOut(`P${i + 1}`, true);
  game.start();

  let draws = 0;
  while (!game.isFinished()) {
    if (draws >= DRAW_LIMIT) {
      throw new Error(
        `Game of ${size} exceeded ${DRAW_LIMIT} draws — the deck is too hot to terminate.`
      );
    }
    game.drawCard();
    draws++;
  }
  // Sit-outs must come out exactly where they were pinned, and must never have
  // been in the queue or the lounge. This is the property the whole locked-slot
  // layer exists to guarantee, so assert it on every simulated game.
  for (const name of game.sitOuts) {
    const slot = game.playerSlots.indexOf(name);
    if (slot === -1 || !game.isLocked(slot)) {
      throw new Error(`${name} sat out but is not pinned to a locked slot`);
    }
    if (game.players.includes(name) || game.movedPlayers.includes(name)) {
      throw new Error(`${name} sat out but ended up back in the queue`);
    }
  }
  // Everyone else has to be on the board exactly once.
  const drafters = game.roster.filter((n) => !game.sitOuts.includes(n));
  for (const name of drafters) {
    if (game.playerSlots.filter((s) => s === name).length !== 1) {
      throw new Error(`${name} was lost or duplicated on the board`);
    }
  }

  return { resets: game.resets, draws };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (sorted, p) => sorted[Math.floor(p * (sorted.length - 1))];
const share = (xs, fn) => (xs.filter(fn).length / xs.length) * 100;

const rows = SIZES.map((size) => {
  const resets = [];
  const draws = [];
  for (let i = 0; i < TRIALS; i++) {
    const game = playOneGame(size);
    resets.push(game.resets);
    draws.push(game.draws);
  }
  resets.sort((a, b) => a - b);
  draws.sort((a, b) => a - b);
  return {
    players: size,
    deck: DECK.copies * (DECK.specials.length + size) + DECK.resets.length,
    mean: +mean(resets).toFixed(2),
    "P(0)": +share(resets, (r) => r === 0).toFixed(1) + "%",
    p50: pct(resets, 0.5),
    p90: pct(resets, 0.9),
    p99: pct(resets, 0.99),
    max: resets[resets.length - 1],
    "P(>=10)": +share(resets, (r) => r >= 10).toFixed(1) + "%",
    drawsMean: Math.round(mean(draws)),
    drawsP95: pct(draws, 0.95),
  };
});

console.log(`Resets per game over ${TRIALS.toLocaleString()} games per league size\n`);
console.table(rows);

// Sit-outs shrink the contested board, so a 12-player league with 6 sitting out
// plays roughly like a 6-player league — fewer drafters, fewer draws, fewer
// resets. Worth seeing next to the baseline before assuming otherwise.
const SIT_OUT_TRIALS = Math.min(TRIALS, 5000);
const sitOutRows = [2, 4, 6].map((out) => {
  const resets = [];
  for (let i = 0; i < SIT_OUT_TRIALS; i++) resets.push(playOneGame(12, out).resets);
  resets.sort((a, b) => a - b);
  return {
    players: 12,
    sittingOut: out,
    drafting: 12 - out,
    mean: +mean(resets).toFixed(2),
    p90: pct(resets, 0.9),
    max: resets[resets.length - 1],
  };
});
console.log(
  `\n12-player league with sit-outs, ${SIT_OUT_TRIALS.toLocaleString()} games each\n`
);
console.table(sitOutRows);

// Targets: mean 3-5, 0-reset games rare, the tail reaching 10+.
const offTarget = rows.filter((r) => r.mean < 3 || r.mean > 5);
if (offTarget.length) {
  console.log(
    `\nOff target (want mean 3-5): ${offTarget
      .map((r) => `${r.players} players -> ${r.mean}`)
      .join(", ")}`
  );
}
