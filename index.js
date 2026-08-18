// DOM layer. The deck and the rules live in game.js (loaded first) so they can
// be simulated from Node — see tools/simulate.mjs.

// Collapse runs so a 12-slot board reads "1-3, 5, 8-12" rather than a wall of
// commas.
function formatSpots(nums) {
  const out = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i + 1 ? `${nums[i]}-${nums[j]}` : nums.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return out.join(", ");
}

// The Joker is the only rule that has to ask a human something. `open` is the
// 1-based list of spots actually available — sit-out slots are already gone.
function promptForSpot(player, open) {
  const locked = game.sitOuts
    .map((name) => ({ name, spot: game.playerSlots.indexOf(name) + 1 }))
    .sort((a, b) => a.spot - b.spot)
    .map((s) => `${s.spot} (${s.name})`)
    .join(", ");

  while (true) {
    const raw = prompt(
      `${player}, pick a draft position.\n` +
        `Available: ${formatSpots(open)}\n` +
        (locked ? `Locked — sat out: ${locked}\n` : "") +
        `Taking a spot bumps whoever is standing in it.`
    );
    // Cancel returns null. Bail instead of trapping the room in a loop.
    if (raw === null) return null;
    const choice = parseInt(raw, 10);
    if (open.includes(choice)) return choice;
    alert(`Pick one of: ${formatSpots(open)}`);
  }
}

const game = createGame({ chooseSpot: promptForSpot });
const ANIMATION_MS = 760;
const playerProfiles = new Map();
const playerJabState = new Map();
let heckleSide = "right";
let activeHecklePlayer = null;
let pendingHeckleTimer = null;
let inactivityTimer = null;
let animationBlockUntil = 0;
const INACTIVITY_MS = 10000;
const END_GIF_MS = 4300;

const PICK_COMMENTS = [
  "The easiest spot on the board, yet you'll still blame the app when your top pick inevitably busts.",
  "Enjoy pretending you have a master strategy while just taking the 1.01's sloppy seconds.",
  "The ultimate false-confidence slot, perfectly designed to help you build a mediocre 7-7 roster.",
  "The participation trophy of the early rounds, which is perfect for hoarding tight ends.",
  "Welcome to the dead center of no-man's land, where you'll draft a \"safe floor\" guy who never wins.",
  "You cried about the league rules just to land the exact middle slot and panic-reach out of boredom.",
  "The most flavorless spot on the board, practically guaranteeing a completely uninspiring roster.",
  "Get ready to silently watch your queue get sniped before panic-picking a washed-up quarterback.",
  "You don't actually control your draft; you just complain about getting sniped every single round.",
  "You'll feel like an absolute genius right up until you're starting an unemployed backup by Week 4.",
  "You possess zero autonomy and exist solely as a helpless hostage to whatever the guy at the turn does.",
  "You get the unique privilege of making two massive, season-ending mistakes at the exact same time.",
];

const CREDIT_DESCRIPTIONS = new Map(Object.entries({
  jtmueller: "You treat Superflex drafts like a looming national crisis, aggressively hoarding starting quarterbacks to construct your own private petroleum reserve. You will still somehow find a way to blame Sleeper's auto-sub feature when your master plan results in starting Mac Jones by Week 5.",
  atomstoadams: "You draft like every pick needs to prove you're the smartest galaxy-brain in the room, culminating in taking a kicker in Round 7. Get ready for four months of leaving unhinged manifestos explaining why reaching 30 spots ahead of ADP was actually a calculated masterpiece.",
  makinrentmoney: "You draft with the exact default factory settings of an uncalibrated Sleeper NPC. You'll build a remarkably balanced, aggressively uninspiring roster that cruises comfortably into your destined 6th-place finish.",
  jakobelder: "You operate the Running Back Industrial Complex with zero higher brain function, hoarding every committee back and third-stringer with a pulse. You will inevitably try to trade three backup tight ends for a starting quarterback before Week 1 waivers even clear.",
  stonerd7: "Your Disaster Capitalism draft strategy gives you full freedom to reach two rounds early on wide receivers who are mathematically destined for the all-ACL team. You'll spend the rest of the season crying about leading the league in points while sitting comfortably in the loser's bracket.",
  jakeythegoat: "You cried and held out on paying your $25 dues just to reach for Kyle Pitts again because you treat toxic player loyalty like a diagnosed medical condition. Enjoy holding onto broken wide receivers three seasons past the point of a formal clinical intervention.",
  kingkaylub: "You draft wide receivers like they're being permanently discontinued while completely ignoring the screaming void at your Superflex spot. By November, you'll be in the chat begging to trade for a backup running back because you treated the position like a distant rumor.",
  spainsgame: "You sit quietly bench-pressing 225 lbs while convincing yourself that starting-caliber quarterbacks magically reproduce overnight. Everyone else panic-buys QBs while you calmly draft another running back and pray some 38-year-old statue is available in Round 9.",
  jdizzzle: "Whether you're drafting from a moving vehicle, a Walmart aisle, or a wedding, you will always treat your QB2 situation like an optional dentist appointment. You'll draft tremendous WR value all night, right up until you accidentally misclick on a guy who tears his ACL three days later.",
  appleg8tor: "You are a pie chart of pure neutrality, drafting a perfectly balanced roster with all the emotional intensity of a corporate HR email. You already volunteered yourself as the caboose of the league, so at least nobody can accuse you of false advertising.",
  hunterthood5: "You aggressively ignore the tight end and quarterback positions until they become a full-blown four-alarm disaster. We look forward to your inevitable, unprompted November chat appearance asking, \"Anyone wanna trade me a QB\".",
  grovergang: "You stuff your draft cart full of eight usable flex players like a doomsday prepper hoarding canned beans. You'll spend every Sunday watching your best 30-point performance rot on the bench while you wonder why Jaxson Dart hasn't unlocked Ultra Instinct yet.",
}));

const PLAYER_JABS = new Map(Object.entries({
  atomstoadams: [
    "You have a league-leading 397 all-time transactions. At what point do you realize that aggressively shuffling the deck chairs on the Titanic won't save your 47% win rate?",
    "You treat the group chat like a degenerate DraftKings diary. No one cares that your 12-leg parlay died because Baker Mayfield missed a throw by two yards.",
    "Renaming your entire team with Star Wars 'Darth' puns doesn't make you an evil empire; it just makes you look like a massive nerd who went 46-50.",
    "You drafted a kicker in the 7th round and bragged about it for ten months because it was literally the only good fantasy decision you've made in a decade.",
  ],
  jakeythegoat: [
    "Congratulations on the 2025 championship. It only took you six years of holding out on $25 league dues and crying about waiver rules to finally get there.",
    "You proudly declared that the 2nd overall pick 'dies in week 2,' completely ignoring that your own team is basically a graveyard by Week 6 every year.",
    "You refused to pay your dues until the commish admitted Dale Jr. was a top 15 driver. It's tragic that NASCAR trivia is your only real leverage in life.",
    "You brag about being 7-0 in preseason fantasy leagues, which is the exact equivalent of peaking in middle school dodgeball.",
  ],
  jdizzzle: [
    "For a guy who builds advanced financial forecasting models in Excel, you are historically terrible at projecting which of your first-round draft picks is going to tear their ACL next.",
    "You literally drafted Malik Nabers by accident instead of Amon-Ra St. Brown. An auto-drafting bot with a glitch has better hand-eye coordination than you do.",
    "Naming your team after your infant's bodily functions is highly appropriate, considering your roster consistently falls apart every single Sunday.",
    "You have executed 274 all-time transactions just to perfectly maintain a fiercely mediocre 53% win rate.",
  ],
  jakobelder: [
    "Your 63% all-time win rate is super impressive until we remember you literally control the rules, the draft structure, and the waiver order.",
    "You've earned the nickname 'Injury Grim Reaper' because the only way you can successfully win a trade is by secretly hexing the other guy's roster.",
    "For a league commissioner, you spend an embarrassing amount of time begging grown men for $25 on Venmo like a desperate telemarketer.",
    "You hoard more tight ends on your active roster than you have actual wins in the playoffs.",
  ],
  grovergang: [
    "Sitting comfortably at 12th place all-time with a 39% win rate. At least your team name is a completely accurate reflection of your management skills.",
    "Your signature move is benching a player on Sunday morning right before they drop a 40-point nuke on your bench.",
    "You thought taking the 12th draft slot was a strategic masterpiece, completely forgetting that you actually have to draft good players for the strategy to work.",
    "You regularly ask the chat if Jaxson Dart is 'the guy' because your ability to evaluate quarterback talent is fundamentally broken.",
  ],
  stonerd7: [
    "You love to claim you led the league in points for three straight years, which is a really sad flex for a guy sitting at a lifetime 52% win rate.",
    "Your entire offensive strategy relies on praying that your 'premium white tight ends' accidentally stumble into a legacy game.",
    "You defend Marlon Mack in the chat like he's your own son, which explains why your roster is usually full of unemployed running backs.",
    "Winning the 2024 championship must have been an absolute fluke, considering you spent the entire 2025 season crying about being the winner of the loser's bracket.",
  ],
  appleg8tor: [
    "You introduced yourself by saying 'I've got no idea what I'm doin' and then drafted Justin Tucker in the 8th round. We know, Alan. We know.",
    "You sit at a cool 40% all-time win rate, safely anchoring the bottom of the league so everyone else can feel slightly better about themselves.",
    "You somehow won Manager of the Week while starting Spencer Rattler. That's not fantasy skill, that's just the universe taking pity on Citrus County.",
    "Your team name is edgy, but the only thing you're successfully terrorizing is your own win-loss record.",
  ],
  jtmueller: [
    "You try to play the 'I'm traveling in Finland' card to explain away your 41% win rate, but international roaming doesn't excuse starting Mac Jones.",
    "You literally had to beg the commish to manually swap your players because you couldn't figure out how the Sleeper auto-sub feature works.",
    "Naming your team 'Epstein's VIPs' is certainly a bold choice for a guy whose fantasy decisions are consistently criminal.",
    "You somehow scored a perfect lineup while maxing out at 100 points, meaning even when you do everything absolutely right, your team still disappoints.",
  ],
  makinrentmoney: [
    "You complain about obnoxious Eagles fans on your flights, but reading your trade offers in the chat is honestly a much worse experience for all of us.",
    "You have 322 all-time transactions just to maintain a 42% win rate. That is an incredible amount of effort to be aggressively below average.",
    "You proudly claimed in the chat that you are 'the definition of average,' but mathematically speaking, you are in 9th place. You aren't average, you're just bad.",
    "You tried to sell off Dylan Sampson and De'Von Achane in a fire sale, proving your name is a lie because your fantasy skills definitely aren't paying the rent.",
  ],
  kingkaylub: [
    "You have three championships, but watching you frantically try to set up a Mario Kart emulator to decide the draft order proves you have way too much free time.",
    "You proudly offer up lopsided trade deals and still somehow ended up rolling with Juwan Johnson as your starting tight end.",
    "Your 60% win rate is great, but everyone knows your team only succeeds because you exclusively prey on the bottom feeders of the league.",
    "You literally traded to get Jalen Hurts just so you could force a meme, proving you care way more about the chat's approval than your actual roster.",
  ],
  spainsgame: [
    "You bragged in the chat about benching 225 pounds, which coincidentally is also the exact number of fantasy points you leave on your bench every single week.",
    "You occasionally drop 170+ point nukes in complete silence, but with a 53% career win rate, we all know you're going to follow it up with an 80-point stinker.",
    "You drafted Russell Wilson to be your savior. You don't need to hit the gym, you need a psychiatric evaluation.",
    "You basically only show up to the chat to ask when the draft is, then disappear for three months to quietly miss the playoffs.",
  ],
  hunterthood5: [
    "You won the league in 2021 and have basically been a ghost ever since. You are the fantasy football equivalent of a one-hit wonder.",
    "Your entire communication style consists of popping in to say 'Bs' when someone claims a defense you wanted off the waiver wire.",
    "You hold a 58% all-time win rate, yet absolutely no one can remember a single impactful fantasy decision you've ever made.",
    "You begged the chat for a quarterback and offered a wide receiver in return, only to completely ghost the league when they actually tried to trade with you.",
  ],
}));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function playerProfile(name) {
  return playerProfiles.get(name) || {};
}

function playerAvatarHtml(name, className = "avatar") {
  const avatarUrl = playerProfile(name).avatarUrl;
  return avatarUrl
    ? `<img class="${className}" src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" />`
    : "";
}

function playerPillHtml(name) {
  return `${playerAvatarHtml(name)}<span>${escapeHtml(name)}</span>`;
}

function jabKeyForPlayer(name) {
  return String(name || "").trim().toLowerCase();
}

function removeHeckle() {
  if (pendingHeckleTimer) {
    window.clearTimeout(pendingHeckleTimer);
    pendingHeckleTimer = null;
  }
  document.querySelectorAll(".turn-heckle").forEach((el) => el.remove());
  activeHecklePlayer = null;
}

function showHeckleForPlayer(player) {
  const key = jabKeyForPlayer(player);
  const jabs = PLAYER_JABS.get(key);
  if (!game.started || game.isFinished() || !jabs) {
    removeHeckle();
    return;
  }

  if (activeHecklePlayer === player && document.querySelector(".turn-heckle")) return;
  removeHeckle();

  const index = playerJabState.get(key) || 0;
  playerJabState.set(key, (index + 1) % jabs.length);
  heckleSide = heckleSide === "right" ? "left" : "right";

  const heckle = document.createElement("aside");
  heckle.className = `turn-heckle is-${heckleSide}`;
  heckle.setAttribute("aria-live", "polite");
  heckle.innerHTML = `
    <div class="heckle-name">${escapeHtml(player)}</div>
    <p>${escapeHtml(jabs[index])}</p>
  `;
  document.body.appendChild(heckle);
  activeHecklePlayer = player;
}

function refreshTurnHeckle() {
  showHeckleForPlayer(game.players[0]);
}

function gifHoldMs(card) {
  if (typeof card === "number") return 4800;
  if (card === "Bomb") return 7400;
  if (card === "Cluster Bomb") return 5600;
  if (card === "Nuke" || card === "Mirror") return 5000;
  if (["King", "Queen", "Jack", "Joker", "Ace"].includes(card)) return 3600;
  return 900;
}

function animationHoldMs(card) {
  return gifHoldMs(card) + 2100;
}

function scheduleNextHeckle(card) {
  if (pendingHeckleTimer) window.clearTimeout(pendingHeckleTimer);
  pendingHeckleTimer = window.setTimeout(() => {
    pendingHeckleTimer = null;
    refreshTurnHeckle();
  }, animationHoldMs(card));
}

function hideIdleOverlay() {
  document.querySelector(".idle-overlay")?.remove();
}

function showIdleOverlay() {
  if (document.querySelector(".idle-overlay")) return;
  if (document.querySelector(".draft-credits") || document.querySelector(".final-results")) return;
  if (Date.now() < animationBlockUntil) {
    resetInactivityTimer(animationBlockUntil - Date.now() + INACTIVITY_MS);
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "idle-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `<img src="Assets/loading.gif" alt="" loading="eager" />`;
  document.body.appendChild(overlay);
}

function resetInactivityTimer(delay = INACTIVITY_MS) {
  if (inactivityTimer) window.clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(showIdleOverlay, delay);
}

function registerActivity() {
  hideIdleOverlay();
  resetInactivityTimer();
}

const specialCardsRules = [
  {
    card: "Queen: <i>Patience</i>",
    description: `
        <p>Place player behind the first player</p>
    `,
  },
  {
    card: "Jack: <i>Trailer</i>",
    description: `
        <p>
          Place player behind the last place player. If that would cause
          collision, place them in spot 1.
        </p>
    `,
  },
  {
    card: "Joker: <i>Choice</i>",
    description: `
        <p>Player chooses the draft position they would like.</p>
    `,
  },
  {
    card: "King: <i>Coup</i>",
    description: `
        <p>
          Place player in spot 1. If that would cause a collision, remove the
          existing player from the board.
        </p>
    `,
  },
  {
    card: "Ace: <i>Pass</i>",
    description: `
        <p>Skip the player's turn.</p>
    `,
  },
  {
    card: "Mirror: <i>Reverse</i>",
    description: `
        <p>Reverse the order of the players. Player who drew draws again.</p>
    `,
  },
  {
    card: "Bomb: <i>Boom</i>",
    description: `
        <p>
          Remove all players from the board and place them back in the queue.
          The player who drew it goes again.
        </p>
    `,
  },
  {
    card: "Nuke: <i>Fallout</i>",
    description: `
        <p>
          Like a Bomb, but the whole queue is reshuffled into a random order
          afterward. The player who drew it still goes again.
        </p>
    `,
  },
  {
    card: "Cluster Bomb: <i>Shrapnel</i>",
    description: `
        <p>
          Blow a random half of the placed players off the board and back into
          the queue. The player who drew it goes again.
        </p>
    `,
  },
];

document.getElementById("rulesList").innerHTML = specialCardsRules
  .map((card) => `<li><h4>${card.card}</h4>${card.description}</li>`)
  .join("");

function addPlayer() {
  if (game.started) return;
  const playerNameInput = document.getElementById("playerNameInput");
  const playerName = playerNameInput.value.trim();
  if (!playerName) return;
  // Everything downstream keys players by name — the queue, the lounge, the
  // sit-out list — so two people sharing a name would corrupt all three.
  if (game.roster.includes(playerName)) {
    alert(`${playerName} is already in the game.`);
    return;
  }
  game.addPlayer(playerName);
  playerNameInput.value = ""; // Clear the input field
  createTableSpaces(game.playerSlots.length); // Update the table spaces
  updateTable();
  populateLists(); // Update the player list display
  renderLineup();
}

// --- Setup: who's playing ------------------------------------------------

// One chip per league member, dimmed when they're sitting the draft out.
function renderLineup() {
  const section = document.getElementById("lineup");
  section.hidden = game.started || game.roster.length === 0;
  if (section.hidden) return;

  // The handler takes an index, never the name: Sleeper display names are
  // arbitrary strings and an apostrophe would break the attribute.
  document.getElementById("lineupChips").innerHTML = game.roster
    .map((player, i) => {
      const out = game.sitOuts.includes(player);
      return `<button type="button" class="chip${out ? " is-out" : ""}" aria-pressed="${out}" onclick="toggleSitOut(${i})">${playerPillHtml(player)}</button>`;
    })
    .join("");

  document.getElementById("lineupCount").textContent =
    `${game.players.length} playing · ${game.sitOuts.length} sitting out`;
  document.getElementById("startDraftBtn").disabled = game.players.length === 0;
}

function toggleSitOut(index) {
  registerActivity();
  if (game.started) return;
  const player = game.roster[index];
  game.setSitOut(player, !game.sitOuts.includes(player));
  renderLineup();
  populateLists(); // "Up next" is a live preview of the real queue
}

// Commit the roster and roll the locked slots. One-shot: the whole point of a
// random assignment is that it happens once, in front of everybody.
function startDraft() {
  registerActivity();
  if (game.started || game.roster.length === 0) return;
  if (game.players.length === 0) {
    setSleeperStatus("error", "Pick at least one person to play before starting.");
    return;
  }
  setSleeperStatus("", "");
  game.randomizeQueue();
  game.start();
  updateTable();
  populateLists();
  replayAnimation(document.querySelector(".board"), "board-start", 1000);
  replayAnimation(document.querySelector(".turn"), "turn-start", 1000);
  applyPhase();
  refreshTurnHeckle();
}

function resetToSetup() {
  registerActivity();
  if (
    game.started &&
    !confirm("Reset the draft? The board and ledger will be cleared.")
  ) {
    return;
  }
  // Keep the sit-outs — re-running a draft almost always means the same people
  // are still out. They can still be toggled before starting again.
  removeHeckle();
  seedPlayers(game.roster, { keepSitOuts: true });
}

// The single place that reconciles the DOM with whether the draft has started.
function applyPhase() {
  const started = game.started;
  document.getElementById("setupControls").classList.toggle("is-locked", started);
  ["sleeperInput", "sleeperSyncBtn", "playerNameInput", "addPlayerBtn", "sleeperAppend"]
    .forEach((id) => {
      document.getElementById(id).disabled = started;
    });
  document.getElementById("resetBtn").hidden = !started;
  document.querySelector(".btn-draw").disabled = !started || game.isFinished();
  renderLineup();
}

// Populate the initial list of players
function populateLists() {
  document.getElementById("remainingPlayersList").innerHTML = game.players
    .map((player, i) => `
      <li class="${i === 0 ? "is-current" : ""}">
        <span class="queue-number">${i + 1}</span>
        ${playerPillHtml(player)}
      </li>
    `)
    .join("");
  document.getElementById("movedPlayersList").innerHTML = game.movedPlayers
    .map((player) => `<li>${playerPillHtml(player)}</li>`)
    .join("");
  if (!game.started) {
    // Before the draft starts an empty queue just means everyone's marked out,
    // which is not the same thing as being done.
    document.querySelector(".active-player").textContent = `Setting up…`;
  } else if (game.isFinished()) {
    document.querySelector(".active-player").textContent = `✨ Finished ✨`;
  } else {
    document.querySelector(".active-player").textContent = `Active Player: ✨${
      game.players[0] || "None"
    }✨`;
  }
  document.getElementById("ledger").innerHTML = game.ledger
    .map((entry) => `<li>${entry}</li>`)
    .join("");
}

// Randomize players list
function randomizePlayers() {
  registerActivity();
  game.randomizeQueue();
  populateLists();
}

// Short, plain-language effect shown under the card so players don't have to
// open the rules to know what just happened.
const CARD_EFFECTS = {
  King: "Coup — takes draft slot 1",
  Queen: "Patience — slots in behind the leader",
  Jack: "Trailer — slots in behind last place",
  Joker: "Choice — picks any open slot",
  Ace: "Pass — turn skipped, draws again later",
  Mirror: "Reverse — board flips, draws again",
  Bomb: "Boom — everyone back to the queue, draws again",
  Nuke: "Fallout — bomb + the queue reshuffles",
  "Cluster Bomb": "Shrapnel — half the board back to the queue",
};

function cardEffectText(card, player) {
  return typeof card === "number"
    ? `${player} takes draft slot ${card}`
    : CARD_EFFECTS[card] || "";
}

function setCardEffect(card, player) {
  const el = document.getElementById("cardEffect");
  if (!el) return;
  el.textContent = cardEffectText(card, player);
}

function replayAnimation(el, className, ms = ANIMATION_MS) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  window.setTimeout(() => el.classList.remove(className), ms);
}

function animateBoardEvent(card, beforeSlots) {
  const board = document.querySelector(".board");
  const rowCells = document.querySelectorAll("#playerTable tbody tr td");
  const changed = game.playerSlots
    .map((name, i) => name !== beforeSlots[i] ? i : -1)
    .filter((i) => i !== -1);

  changed.forEach((i) => replayAnimation(rowCells[i], "slot-changed", 900));

  if (card === "Mirror") {
    replayAnimation(board, "board-mirror", 900);
  } else if (card === "Bomb" || card === "Nuke") {
    replayAnimation(board, card === "Nuke" ? "board-nuke" : "board-bomb", 950);
  } else if (card === "Cluster Bomb") {
    replayAnimation(board, "board-cluster", 950);
  }
}

function animateCardReveal(card) {
  const cardEl = document.getElementById("card");
  cardEl.classList.toggle("specialCard", typeof card !== "number");
  cardEl.classList.toggle("resetCard", ["Bomb", "Nuke", "Cluster Bomb"].includes(card));
  replayAnimation(cardEl, "card-reveal", 700);
}

function showDrawBurst(card, player) {
  const existing = document.querySelector(".draw-burst");
  if (existing) existing.remove();

  const burst = document.createElement("div");
  burst.className = `draw-burst${["Bomb", "Nuke", "Cluster Bomb"].includes(card) ? " is-reset" : ""}`;
  burst.setAttribute("aria-hidden", "true");
  burst.innerHTML = `<strong>${card}</strong><span>${player}</span>`;
  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 1200);
}

function showNumberGif(card) {
  if (typeof card !== "number") return;

  const existing = document.querySelector(".number-gif-pop");
  if (existing) existing.remove();

  const pop = document.createElement("div");
  pop.className = "number-gif-pop";
  pop.setAttribute("aria-hidden", "true");
  pop.innerHTML = `<img src="Assets/${card}.gif" alt="" loading="eager" />`;
  document.body.appendChild(pop);
  window.setTimeout(() => pop.remove(), 4200);
}

function showGifOverlay(src, duration = 2600, className = "") {
  const existing = document.querySelector(".gif-pop");
  if (existing) existing.remove();

  const pop = document.createElement("div");
  pop.className = `gif-pop${className ? ` ${className}` : ""}`;
  pop.setAttribute("aria-hidden", "true");
  pop.innerHTML = `<img src="${src}" alt="" loading="eager" />`;
  document.body.appendChild(pop);
  window.setTimeout(() => pop.remove(), duration);
}

function showSpecialGif(card) {
  const sequences = {
    Bomb: ["Assets/bomb1.gif", "Assets/bomb2.gif", "Assets/bomb1.gif", "Assets/bomb2.gif"],
    Nuke: ["Assets/nuke.gif"],
    "Cluster Bomb": ["Assets/cluster.gif", "Assets/shrapnel.gif"],
    Mirror: ["Assets/mirror.gif"],
    King: ["Assets/king.gif"],
    Queen: ["Assets/queen.gif"],
    Jack: ["Assets/jack.gif"],
    Joker: ["Assets/joker.gif"],
    Ace: ["Assets/ace.gif"],
  };
  const sequence = sequences[card];
  if (!sequence) return;

  const stepMs = card === "Bomb"
    ? 1650
    : card === "Cluster Bomb"
      ? 2300
      : ["King", "Queen", "Jack", "Joker", "Ace"].includes(card)
        ? 3600
        : 4300;
  sequence.forEach((src, index) => {
    window.setTimeout(
      () => showGifOverlay(src, stepMs, typeof card === "string" ? card.toLowerCase().replaceAll(" ", "-") : ""),
      540 + index * stepMs
    );
  });
}

function showEffectPop(text) {
  if (!text) return;
  const existing = document.querySelector(".effect-pop");
  if (existing) existing.remove();

  const pop = document.createElement("div");
  pop.className = "effect-pop";
  pop.setAttribute("aria-live", "polite");
  pop.textContent = text;
  document.body.appendChild(pop);
  window.setTimeout(() => pop.remove(), 1850);
}

function scheduleEffectPop(card, player) {
  window.setTimeout(() => {
    showEffectPop(cardEffectText(card, player));
  }, gifHoldMs(card));
}

function animateLedgerEntry() {
  const latest = document.querySelector("#ledger li:last-child");
  replayAnimation(latest, "ledger-new", 900);
}

function celebrateFinish() {
  const existing = document.querySelector(".celebration");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "celebration";
  overlay.setAttribute("aria-hidden", "true");
  const pieces = Array.from({ length: 28 }, (_, i) => {
    const left = Math.round(3 + Math.random() * 94);
    const delay = Math.round(Math.random() * 260);
    return `<span style="--left:${left}%; --delay:${delay}ms; --spin:${i % 2 ? 1 : -1};"></span>`;
  }).join("");
  overlay.innerHTML = pieces;
  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), 1800);
}

function showFinalResults() {
  hideIdleOverlay();
  document.querySelector(".final-results")?.remove();

  const results = game.playerSlots
    .map((player, i) => ({ player, pick: i + 1 }))
    .filter((row) => row.player);

  const overlay = document.createElement("div");
  overlay.className = "final-results";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="final-panel">
      <button type="button" class="final-close" onclick="this.closest('.final-results').remove()">Close</button>
      <div class="final-kicker">Final Draft Order</div>
      <ol class="final-list">
        ${results.map(({ player, pick }) => `
          <li>
            <div class="final-rank">Pick ${pick}</div>
            <div class="final-player">
              ${playerAvatarHtml(player, "final-avatar")}
              <strong>${escapeHtml(player)}</strong>
            </div>
            <p>${escapeHtml(PICK_COMMENTS[pick - 1] || "The app has spoken. Good luck pretending this was the plan.")}</p>
          </li>
        `).join("")}
      </ol>
    </div>
  `;
  document.body.appendChild(overlay);
}

function finalDraftRows() {
  return game.playerSlots
    .map((player, i) => ({ player, pick: i + 1 }))
    .filter((row) => row.player);
}

function showRollingCredits(onDone) {
  hideIdleOverlay();
  document.querySelector(".draft-credits")?.remove();
  const rows = finalDraftRows();
  if (rows.length === 0) {
    onDone();
    return;
  }

  const duration = Math.max(22000, rows.length * 3600);
  animationBlockUntil = Date.now() + duration + 10000;
  const overlay = document.createElement("div");
  overlay.className = "draft-credits";
  overlay.style.setProperty("--credits-duration", `${duration}ms`);
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <button type="button" class="credits-skip">Skip</button>
    <div class="credits-roll">
      <div class="credits-title">Draft Night Credits</div>
      ${rows.map(({ player, pick }) => {
        const description = CREDIT_DESCRIPTIONS.get(jabKeyForPlayer(player)) || "";
        return `
          <section class="credit-entry">
            <div class="credit-pick">Pick ${pick}</div>
            <div class="credit-player">
              ${playerAvatarHtml(player, "credit-avatar")}
              <strong>${escapeHtml(player)}</strong>
            </div>
            <p>${escapeHtml(description)}</p>
          </section>
        `;
      }).join("")}
      <div class="credits-end">Good luck. You're going to need it.</div>
    </div>
  `;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    overlay.remove();
    onDone();
  };
  overlay.querySelector(".credits-skip").addEventListener("click", finish);
  document.body.appendChild(overlay);
  window.setTimeout(finish, duration);
}

function playEndSequence(delay) {
  window.setTimeout(() => {
    showGifOverlay("Assets/end.gif", END_GIF_MS, "end");
    window.setTimeout(() => showRollingCredits(showFinalResults), END_GIF_MS);
  }, delay);
}

function drawCard() {
  registerActivity();
  if (!game.started) return;
  removeHeckle();
  const beforeSlots = [...game.playerSlots];
  const drawn = game.drawCard();
  if (!drawn) return;

  document.getElementById("mostRecentCard").textContent = `${drawn.card}`;
  animateCardReveal(drawn.card);
  showDrawBurst(drawn.card, drawn.player);
  window.setTimeout(() => showNumberGif(drawn.card), 520);
  showSpecialGif(drawn.card);
  setCardEffect(drawn.card, drawn.player);
  scheduleEffectPop(drawn.card, drawn.player);

  // A finished draft leaves a partly dealt deck behind; start the next one
  // from a full deck.
  const finished = game.isFinished();
  if (finished) game.shuffle();
  const finishDelay = animationHoldMs(drawn.card);
  animationBlockUntil = Date.now() + finishDelay + (finished ? END_GIF_MS + 10000 : 0);

  updateTable();
  populateLists();
  animateBoardEvent(drawn.card, beforeSlots);
  animateLedgerEntry();
  if (finished) {
    celebrateFinish();
    playEndSequence(finishDelay);
  }
  applyPhase();
  if (!finished) scheduleNextHeckle(drawn.card);
}

// Update table slots display
function updateTable() {
  const rowCells = document.querySelectorAll("#playerTable tbody tr td");
  rowCells.forEach((cell, idx) => {
    const existingNameDiv = cell.querySelector(".name-div"); // Find the existing name div
    if (existingNameDiv) {
      cell.removeChild(existingNameDiv); // Remove the existing name div if it exists
    }
    const nameDiv = document.createElement("div"); // Create a new div for the name
    nameDiv.className = "name-div"; // Add a class name to the new div
    const playerName = game.playerSlots[idx] || "";
    if (playerName) {
      nameDiv.innerHTML = playerPillHtml(playerName);
    } else {
      nameDiv.textContent = "";
    }
    cell.appendChild(nameDiv); // Append the name div to the td
    // A locked cell reads as *settled*, not as *won*, so it takes .locked
    // instead of .filled rather than stacking both.
    const locked = game.isLocked(idx);
    cell.classList.toggle("filled", Boolean(game.playerSlots[idx]) && !locked);
    cell.classList.toggle("locked", locked);
    cell.title = locked
      ? `${playerName} sat out — this spot is locked`
      : "";
  });
  renderSittingOut();
}

// A quiet line under the board naming who's locked and where, so the dashed
// cells don't need a legend. Slots are read live off the board rather than
// cached, so if a pin ever moved this would show it.
function renderSittingOut() {
  const el = document.getElementById("sittingOut");
  el.hidden = !game.started || game.sitOuts.length === 0;
  if (el.hidden) return;
  el.innerHTML =
    `<span class="sitting-out-label">Sitting out</span>` +
    game.sitOuts
      .map((player) => {
        const spot = game.playerSlots.indexOf(player) + 1;
        return `<span class="chip-locked">${playerPillHtml(player)} <b>#${spot}</b></span>`;
      })
      .join("");
}

function createTableSpaces(number) {
  // update the table header width
  var thElement = document.getElementById("draft-order");
  thElement.setAttribute("colspan", Math.max(number, 1));

  var trElement = document.getElementById("draftersRow");
  trElement.innerHTML = "";

  // An empty board would make the width below "Infinity%" and apply it to
  // every cell on the page.
  if (number <= 0) return;

  for (let i = 1; i <= number; i++) {
    const td = document.createElement("td");
    const div = document.createElement("div"); // Create a div for the number label
    div.textContent = i; // Set the text content of the div to the number
    td.appendChild(div); // Append the text node to the td
    trElement.appendChild(td);
  }

  // set the width of each cell
  const width = 100 / number + "%";

  let elements = document.querySelectorAll("th"); // Replace with your actual class or selector
  elements = [...elements, ...document.querySelectorAll("td")]; // Replace with your actual class or selector

  elements.forEach((element) => {
    element.style.width = width;
  });
}

createTableSpaces(game.playerSlots.length); // one cell per league member
populateLists(); // Populate lists initially
applyPhase();

// --- Sleeper auto-sync ---------------------------------------------------
// `syncFromSleeper` and `leagueMembers` come from sleeper.js (loaded first).

// Seed the game's player list from an array of names. Without `append` this is
// a fresh start: the board, lounge and ledger all reset. Either way this
// returns to setup, so the sit-out slots get re-rolled against the new roster.
function seedPlayers(names, { append = false, keepSitOuts = false } = {}) {
  removeHeckle();
  game.seed(names, { append, keepSitOuts });
  createTableSpaces(game.playerSlots.length);
  updateTable();
  populateLists();
  applyPhase();
}

function setSleeperStatus(kind, message) {
  const status = document.getElementById("sleeperStatus");
  status.className = `sleeper-status ${kind}`;
  status.textContent = message;
}

function applyMembers(result, append) {
  if (!append) playerProfiles.clear();
  result.members.forEach((member) => {
    playerProfiles.set(member.name, {
      id: member.id,
      teamName: member.teamName,
      avatarUrl: member.avatarUrl,
    });
  });
  const names = result.members.map((m) => m.name);
  seedPlayers(names, { append });
  setSleeperStatus("success", `Loaded ${names.length} drafters from ${result.leagueName}.`);
  document.getElementById("sleeperLeaguePicker").innerHTML = "";
}

// When a username maps to more than one league, let the user pick which.
function renderLeaguePicker(leagues, append) {
  const picker = document.getElementById("sleeperLeaguePicker");
  picker.innerHTML = "";
  leagues.forEach((lg) => {
    const btn = document.createElement("button");
    btn.textContent = lg.name;
    btn.onclick = async () => {
      setSleeperStatus("loading", "Loading members…");
      try {
        const members = await leagueMembers(lg.league_id);
        applyMembers({ leagueName: lg.name, members }, append);
      } catch (err) {
        setSleeperStatus("error", err.message || "Failed to load that league.");
      }
    };
    picker.appendChild(btn);
  });
}

async function handleSleeperSync() {
  registerActivity();
  const input = document.getElementById("sleeperInput").value;
  const append = document.getElementById("sleeperAppend").checked;
  const btn = document.getElementById("sleeperSyncBtn");
  document.getElementById("sleeperLeaguePicker").innerHTML = "";
  setSleeperStatus("loading", "Syncing…");
  btn.disabled = true;
  try {
    const result = await syncFromSleeper(input);
    if (result.kind === "choose-league") {
      setSleeperStatus("", "Multiple leagues found — pick one:");
      renderLeaguePicker(result.leagues, append);
    } else {
      applyMembers(result, append);
    }
  } catch (err) {
    setSleeperStatus("error", err.message || "Sleeper sync failed.");
  } finally {
    btn.disabled = false;
  }
}

// Let Enter in the Sleeper box trigger a sync.
document.getElementById("sleeperInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSleeperSync();
});

["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, registerActivity, { passive: true });
});
resetInactivityTimer();
