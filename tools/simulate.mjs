// Measures how many resets an average draft runs, against the real rules in
// game.js. Run with: node tools/simulate.mjs [trials]
//
// The deck is tuned for 3-5 resets on average, ~2% of drafts with none, and a
// natural tail where a few percent reach 10 or more. Everything keys off the
// number of *drafters* — sit-outs hold a locked slot and never draw — so that
// is what these tables are indexed by. Re-run this after touching DECK in
// game.js: the knobs interact sharply, because a reset clears the board, which
// means more draws, which means more resets.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createGame, DECK } = require("../game.js");

const TRIALS = Number(process.argv[2]) || 40000;
const DRAFTER_COUNTS = [1, 2, 4, 6, 8, 10, 12, 14, 16, 20];

// Guards against a tuning mistake that makes drafts never terminate.
const DRAW_LIMIT = 100000;

// `drafters` people draw cards; `sitOuts` more are in the league but locked to
// a random slot. The reset numbers should depend only on the former.
function playOneGame(drafters, sitOuts = 0) {
  // The Joker asks a human for a spot; a random pick from what's open stands in.
  const game = createGame({
    chooseSpot: (_player, open) => open[Math.floor(Math.random() * open.length)],
  });
  const roster = drafters + sitOuts;
  game.seed(Array.from({ length: roster }, (_, i) => `P${i + 1}`));
  // Sit the last `sitOuts` members out, so `drafters` are left drawing.
  for (let i = 0; i < sitOuts; i++) game.setSitOut(`P${roster - i}`, true);
  game.start();

  let draws = 0;
  while (!game.isFinished()) {
    if (draws >= DRAW_LIMIT) {
      throw new Error(
        `${drafters} drafters exceeded ${DRAW_LIMIT} draws — the deck is too hot to terminate.`
      );
    }
    game.drawCard();
    draws++;
  }

  // Sit-outs must come out exactly where they were pinned, and must never have
  // been in the queue or the lounge. This is the property the whole locked-slot
  // layer exists to guarantee, so assert it on every simulated draft.
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
  for (const name of game.roster.filter((n) => !game.sitOuts.includes(n))) {
    if (game.playerSlots.filter((s) => s === name).length !== 1) {
      throw new Error(`${name} was lost or duplicated on the board`);
    }
  }

  return { resets: game.resets, draws };
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (sorted, p) => sorted[Math.floor(p * (sorted.length - 1))];
const share = (xs, fn) => `${+((xs.filter(fn).length / xs.length) * 100).toFixed(1)}%`;

function measure(drafters, sitOuts, trials) {
  const resets = [];
  const draws = [];
  for (let i = 0; i < trials; i++) {
    const game = playOneGame(drafters, sitOuts);
    resets.push(game.resets);
    draws.push(game.draws);
  }
  resets.sort((a, b) => a - b);
  draws.sort((a, b) => a - b);
  return {
    mean: +mean(resets).toFixed(2),
    "P(0)": share(resets, (r) => r === 0),
    p50: pct(resets, 0.5),
    p90: pct(resets, 0.9),
    p99: pct(resets, 0.99),
    max: resets[resets.length - 1],
    "P(>=10)": share(resets, (r) => r >= 10),
    drawsMean: Math.round(mean(draws)),
    drawsP95: pct(draws, 0.95),
  };
}

// --- The tuning table, indexed by drafters -------------------------------
const rows = DRAFTER_COUNTS.map((drafters) => ({
  drafters,
  resetCards: DECK.resetCards(drafters).length,
  deck:
    DECK.copies * (DECK.specials.length + drafters) +
    DECK.resetCards(drafters).length,
  ...measure(drafters, 0, TRIALS),
}));

console.log(`Resets per draft over ${TRIALS.toLocaleString()} drafts per drafter count\n`);
console.table(rows);

// --- Sit-outs must not move the numbers ----------------------------------
// Same 6 drafters, increasingly large league behind them. If these rows drift
// apart, something is keying off the roster instead of the drafter count.
const SIT_OUT_TRIALS = Math.min(TRIALS, 8000);
const sitOutRows = [0, 2, 4, 6, 10].map((sitOuts) => {
  const m = measure(6, sitOuts, SIT_OUT_TRIALS);
  return {
    drafters: 6,
    sittingOut: sitOuts,
    league: 6 + sitOuts,
    mean: m.mean,
    p90: m.p90,
    max: m.max,
    drawsMean: m.drawsMean,
  };
});
console.log(
  `\n6 drafters, varying league size, ${SIT_OUT_TRIALS.toLocaleString()} drafts each\n`
);
console.table(sitOutRows);

// --- Checks --------------------------------------------------------------
const problems = [];

// A one-person draft is over in about three draws; there is no order to
// scramble, so it is exempt from the band.
for (const row of rows) {
  if (row.drafters > 1 && (row.mean < 3 || row.mean > 5)) {
    problems.push(`${row.drafters} drafters average ${row.mean} resets (want 3-5)`);
  }
}

// Sit-outs change the league, not the game. Allow a little sampling noise.
const sitOutMeans = sitOutRows.map((r) => r.mean);
const spread = Math.max(...sitOutMeans) - Math.min(...sitOutMeans);
if (spread > 0.5) {
  problems.push(
    `sit-outs shifted the mean by ${spread.toFixed(2)} (${sitOutMeans.join(", ")}) — ` +
      `something is keying off roster size instead of drafters`
  );
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nAll checks passed: mean 3-5 resets for every drafter count, sit-outs neutral.");
}
