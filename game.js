// Deck composition and the draft-order rules. Nothing in this file touches the
// DOM, so the same code that runs the app can be driven from Node — see
// tools/simulate.mjs, which is how the numbers below were measured.

// Tuned so an average game runs 3-5 resets (Bomb / Nuke / Cluster Bomb),
// 0-reset games are ~2%, and ~2-5% of games reach 10 or more. Measured over
// 40k games per league size:
//
//   players | mean resets | P(0) | p90 | max | P(>=10) | mean draws
//        8  |    3.5      | 1.7% |  6  |  21 |   0.7%  |    23
//       10  |    3.9      | 2.5% |  7  |  26 |   1.9%  |    30
//       12  |    4.2      | 1.6% |  7  |  25 |   3.7%  |    37
//       14  |    4.6      | 2.1% |  7  |  28 |   5.4%  |    44
//       16  |    4.8      | 1.8% |  7  |  31 |   7.2%  |    51
//
// The knobs interact sharply — a reset clears the board, which means more
// draws, which means more resets — so re-run the simulator before changing
// any of these numbers. `copies` exists to make the reset count a fine enough
// knob: at one copy of each card, 2 reset cards averages 3.1 resets and 3
// averages 9.2, with nothing in between.
const DECK = {
  copies: 3, // copies of every non-reset card
  specials: ["Queen", "Jack", "Joker", "King", "Ace", "Mirror"],
  resets: ["Bomb", "Bomb", "Bomb", "Bomb", "Bomb", "Nuke", "Cluster Bomb"],
  leadResetWindow: 1.25, // lead reset card lands in the first 1.25 * players cards
};

const RESET_CARDS = new Set(["Bomb", "Nuke", "Cluster Bomb"]);

// Fisher-Yates. `sort(() => Math.random() - 0.5)` is not a fair shuffle.
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// `chooseSpot(player, openSpots)` is the one place the rules need to ask a
// human something (the Joker); the caller supplies it. `openSpots` is the
// 1-based list of positions actually available — locked sit-out slots are
// already filtered out.
function createGame({ chooseSpot } = {}) {
  const game = {
    roster: [], // every league member — the board is one slot each
    players: [], // the queue: roster minus sit-outs
    sitOuts: [], // members who aren't playing the card game
    lockedSlots: new Set(), // slot indices pinned to a sit-out; set by start()
    started: false,
    movedPlayers: [],
    playerSlots: [],
    cards: [],
    ledger: [],
    resets: 0,
    seed,
    addPlayer,
    setSitOut,
    start,
    shuffle,
    drawCard,
    randomizeQueue,
    isFinished,
    isLocked,
    openPositions,
  };

  // --- Locked slots ------------------------------------------------------
  //
  // A sit-out is dealt a random slot before the first card and is then
  // immovable: no card may move them out of it or drop anyone else into it.
  // The lock belongs to the *position*, not the occupant — that is what keeps
  // Mirror's permutation from carrying a pin along with the name.
  //
  // Two invariants hold everything together:
  //   1. A sit-out is never in `players` or `movedPlayers`. That alone makes
  //      Bomb and Nuke correct: their queue merge structurally cannot re-queue
  //      a pinned player.
  //   2. Unlocked slots == drafters. So the last drawer always has somewhere
  //      to land, and the game still terminates.

  function isLocked(i) {
    return game.lockedSlots.has(i);
  }

  function isSitOut(name) {
    return game.sitOuts.includes(name);
  }

  // Unlocked slot indices, ascending — the contestable board.
  function openPositions() {
    const open = [];
    for (let i = 0; i < game.playerSlots.length; i++) {
      if (!isLocked(i)) open.push(i);
    }
    return open;
  }

  // Nearest unlocked index from `i` travelling in `dir`, wrapping. Accepts
  // out-of-range and negative input. Returns -1 only if every slot is locked.
  function scanUnlocked(i, dir) {
    const n = game.playerSlots.length;
    if (n === 0) return -1;
    for (let step = 0; step < n; step++) {
      const idx = (((i + dir * step) % n) + n) % n;
      if (!isLocked(idx)) return idx;
    }
    return -1;
  }

  const nextUnlocked = (i) => scanUnlocked(i, 1);
  const prevUnlocked = (i) => scanUnlocked(i, -1);

  // A knocked-off player goes to the back of the queue. Sit-outs never do —
  // they are not in the queue and must not be added to it.
  function returnToQueue(name) {
    if (name && !isSitOut(name)) removeFromChillList(name);
  }

  // Mark a member in or out of the card game. Setup only: the slot roll in
  // start() has to happen once, against a final roster.
  function setSitOut(name, out) {
    if (game.started) return;
    const at = game.sitOuts.indexOf(name);
    if (out && at === -1) {
      game.sitOuts.push(name);
      game.players = game.players.filter((p) => p !== name);
    } else if (!out && at !== -1) {
      game.sitOuts.splice(at, 1);
      // Back of the queue, so re-adding somebody is predictable.
      if (!game.players.includes(name)) game.players.push(name);
    }
    shuffle();
  }

  // Commit the roster: deal every sit-out a random slot and lock it. Idempotent
  // and implicit — drawCard() calls it, so a caller that never sits anyone out
  // (the simulator) needs no start step at all.
  function start() {
    if (game.started) return;
    game.started = true;
    game.lockedSlots = new Set();

    const picks = shuffleArray([...game.playerSlots.keys()]).slice(
      0,
      game.sitOuts.length
    );
    game.sitOuts.forEach((name, i) => {
      const slot = picks[i];
      game.playerSlots[slot] = name;
      game.lockedSlots.add(slot);
    });

    if (game.sitOuts.length) {
      game.ledger.push(
        `Draft started with ${game.players.length} of ${game.roster.length} playing`
      );
      // In slot order, read back off the board, so the ledger reads like the
      // board and cannot drift from it.
      game.playerSlots.forEach((name, i) => {
        if (isLocked(i)) game.ledger.push(`${name} sat out, locked to spot ${i + 1}`);
      });
    }

    shuffle();
  }

  // Build a fresh, pre-shuffled deck dealt from the top. One reset card is held
  // back and placed into the first `leadResetWindow * board size` positions:
  // a game needs at least one draw per player, so without that bias roughly one
  // game in seven would finish before any bomb ever surfaced.
  function shuffle() {
    // One number card per *available* slot. A locked slot is never on offer,
    // which is what makes it impossible to draw your way into a sit-out's spot.
    const open = openPositions();
    const size = open.length;
    const deck = [];
    for (let copy = 0; copy < DECK.copies; copy++) {
      deck.push(...DECK.specials);
      for (const i of open) deck.push(i + 1);
    }

    const resets = [...DECK.resets];
    const lead = resets.pop();
    deck.push(...resets);
    shuffleArray(deck);

    if (lead !== undefined) {
      const window = Math.max(1, Math.ceil(DECK.leadResetWindow * size));
      const at = Math.floor(Math.random() * Math.min(window, deck.length + 1));
      deck.splice(at, 0, lead);
    }

    game.cards = deck;
  }

  // Start a game from a list of names. Without `append` this is a fresh start:
  // the board, lounge and ledger all reset. With `append` the names join the
  // queue and any current placements are preserved.
  // Re-seeding always returns to setup, so the sit-out slots are re-rolled
  // against the new roster rather than pointing at slots that have moved.
  function seed(names, { append = false, keepSitOuts = false } = {}) {
    const cleaned = names.map((n) => String(n).trim()).filter(Boolean);
    if (append) {
      game.roster = [...game.roster, ...cleaned];
    } else {
      game.roster = cleaned;
      game.movedPlayers = [];
      game.ledger = [];
      game.resets = 0;
      if (!keepSitOuts) game.sitOuts = [];
    }
    // Drop anyone who sat out of a league they're no longer in.
    game.sitOuts = game.sitOuts.filter((n) => game.roster.includes(n));
    game.players = game.roster.filter((n) => !isSitOut(n));
    game.started = false;
    game.lockedSlots = new Set();
    game.playerSlots = Array(game.roster.length).fill(null);
    shuffle();
  }

  function addPlayer(name) {
    if (game.started) return;
    game.roster.push(name);
    game.players.push(name);
    game.playerSlots = Array(game.roster.length).fill(null);
    shuffle();
  }

  function randomizeQueue() {
    shuffleArray(game.players);
  }

  function isFinished() {
    return game.players.length === 0;
  }

  // Draw the top card and resolve it. Returns `{ card, player }`, or null if
  // the draft is already over.
  function drawCard() {
    if (!game.started) start();
    if (game.players.length === 0) return null;
    if (game.cards.length === 0) {
      shuffle();
      game.ledger.push("Deck ran out — reshuffled");
    }

    const drawnCard = game.cards.shift();
    const activePlayer = game.players.shift();
    game.ledger.push(`${activePlayer} drew ${drawnCard}`);
    game.movedPlayers.push(activePlayer);

    if (RESET_CARDS.has(drawnCard)) game.resets++;

    handleCard(drawnCard, activePlayer);
    return { card: drawnCard, player: activePlayer };
  }

  function handleCard(card, player) {
    if (typeof card === "number") {
      bumpAndAssign(card - 1, player);
    } else {
      handleSpecialCard(card, player);
    }
  }

  // The one placement primitive: put `player` at `index`, shoving whoever is
  // there downward (wrapping) until somebody lands in an empty spot.
  //
  // Locked slots are not part of the walk at all — never a landing spot, never
  // a shove victim — so the cascade steps straight over them.
  function bumpAndAssign(index, player) {
    const slots = game.playerSlots;
    const n = slots.length;
    if (n === 0) {
      returnToQueue(player);
      return;
    }

    index = (((index % n) + n) % n); // normalize any input onto the board
    // A locked target resolves downward, the same way the cascade travels, so
    // shoving into a pin behaves like a shove that started one slot earlier.
    let currentIndex = isLocked(index) ? prevUnlocked(index) : index;
    if (currentIndex === -1) {
      returnToQueue(player); // whole board is locked
      return;
    }

    // `prevUnlocked(k - 1)` is the cyclic predecessor on the unlocked set: one
    // cycle of length `capacity`. So `capacity` steps visit `capacity` distinct
    // slots and the loop cannot revisit one, whatever the board looks like.
    const capacity = n - game.lockedSlots.size;
    for (let visited = 0; visited < capacity; visited++) {
      if (!slots[currentIndex]) {
        slots[currentIndex] = player;
        return;
      }
      // One write and one take per step, so exactly one name is ever in flight.
      const displaced = slots[currentIndex];
      slots[currentIndex] = player;
      player = displaced;
      currentIndex = prevUnlocked(currentIndex - 1);
    }

    // Every open slot was occupied. Unreachable while unlocked slots ==
    // drafters; if that invariant ever breaks, re-queue rather than drop
    // somebody off the board entirely.
    game.ledger.push(`${player} had nowhere to land and went back to the queue`);
    returnToQueue(player);
  }

  function handleSpecialCard(card, player) {
    const slots = game.playerSlots;
    let index = 0;
    switch (card) {
      // Queen and Jack both count a sit-out as a placed player. They're on the
      // board holding a draft slot, so "behind the first/last player" follows
      // what the room can see.
      case "Queen": {
        // Place player behind the first player.
        index = slots.findIndex((slot) => slot !== null);
        const target = nextUnlocked(index === -1 ? 0 : index + 1);
        if (target === -1) {
          returnToQueue(player);
          return;
        }
        bumpAndAssign(target, player);
        return;
      }
      case "Jack": {
        // Place player behind the last player. The wrap in nextUnlocked is the
        // old "if that would collide, place them in spot 1" rule.
        index = -1;
        for (let i = slots.length - 1; i >= 0; i--) {
          if (slots[i] !== null) {
            index = i;
            break;
          }
        }
        const target = nextUnlocked(index === -1 ? 0 : index + 1);
        if (target === -1) {
          returnToQueue(player);
          return;
        }
        bumpAndAssign(target, player);
        return;
      }
      case "Joker": {
        const open = openPositions().map((i) => i + 1);
        if (open.length === 0) {
          returnToQueue(player);
          return;
        }
        const choice = chooseSpot(player, open);
        if (!open.includes(choice)) {
          // The chooser passed or gave up; treat it as an Ace.
          game.ledger.push(`${player} passed on the Joker`);
          returnToQueue(player);
          return;
        }
        bumpAndAssign(choice - 1, player);
        game.ledger.push(`${player} chose spot ${choice}`);
        return;
      }
      case "King": {
        // Coup the best *contestable* spot. If a sit-out is pinned to slot 1,
        // slot 1 isn't part of the game, so the coup takes the best slot that
        // is — a no-op would make King strictly worse than a number card.
        const target = nextUnlocked(0);
        if (target === -1) {
          returnToQueue(player);
          return;
        }
        // Evict rather than cascade; target is unlocked, so never a sit-out.
        if (slots[target]) removeFromChillList(slots[target]);
        slots[target] = player;
        if (target !== 0) {
          game.ledger.push(`${player} couped spot ${target + 1} (spot 1 is locked)`);
        }
        return;
      }
      case "Ace":
        removeFromChillList(player);
        return;
      case "Mirror": {
        // Reverse the contest, not the pins: the open slots keep their
        // positions and their contents reverse among themselves. With nobody
        // sitting out this is exactly slots.reverse().
        const open = openPositions();
        const values = open.map((i) => slots[i]).reverse();
        open.forEach((slot, k) => {
          slots[slot] = values[k];
        });
        // Add the player back to the front of the queue
        takeAnotherTurn(player);
        return;
      }
      case "Bomb":
        // Remove all players from the board and place them back in the queue.
        takeAnotherTurn(player);
        returnAllToQueue();
        return;
      case "Nuke": {
        // A bomb that also reshuffles the queue behind the drawer.
        takeAnotherTurn(player);
        returnAllToQueue();
        const drawer = game.players.shift();
        shuffleArray(game.players);
        game.players.unshift(drawer);
        return;
      }
      case "Cluster Bomb": {
        // Blow a random half of the placed players back into the queue.
        // Sit-outs are shrapnel-proof. Selecting over slot indices rather than
        // names also stops one chosen name from clearing two slots at once.
        takeAnotherTurn(player);
        const occupied = openPositions().filter((i) => slots[i]);
        const doomed = shuffleArray(occupied).slice(0, Math.ceil(occupied.length / 2));
        for (const i of doomed) {
          removeFromChillList(slots[i]);
          slots[i] = null;
        }
        return;
      }
      default:
        throw new Error(`Invalid card: ${card}`);
    }
  }

  function removeFromChillList(player) {
    game.players.push(player);
    const indexOfCollisionPlayer = game.movedPlayers.indexOf(player);
    if (indexOfCollisionPlayer !== -1) {
      game.movedPlayers.splice(indexOfCollisionPlayer, 1);
    }
  }

  // Everyone who has been placed on the board goes back into the queue; the
  // board and the Chilling Lounge both clear. Call *after* re-queueing the
  // drawer with takeAnotherTurn so they keep their spot at the front.
  //
  // Pinned sit-out slots survive the blast. The clear is selective and in
  // place — blanking the whole array here would wipe sit-outs off the board
  // with no way back, since they're in neither list being merged.
  function returnAllToQueue() {
    game.players = [...game.players, ...game.movedPlayers.filter((n) => !isSitOut(n))];
    game.movedPlayers = [];
    for (let i = 0; i < game.playerSlots.length; i++) {
      if (!isLocked(i)) game.playerSlots[i] = null;
    }
  }

  function takeAnotherTurn(player) {
    game.players.unshift(player);
    const indexOfCollisionPlayer = game.movedPlayers.indexOf(player);
    if (indexOfCollisionPlayer !== -1) {
      game.movedPlayers.splice(indexOfCollisionPlayer, 1);
    }
  }

  return game;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createGame, shuffleArray, DECK, RESET_CARDS };
}
