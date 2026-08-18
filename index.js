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
      return `<button type="button" class="chip${out ? " is-out" : ""}" aria-pressed="${out}" onclick="toggleSitOut(${i})">${player}</button>`;
    })
    .join("");

  document.getElementById("lineupCount").textContent =
    `${game.players.length} playing · ${game.sitOuts.length} sitting out`;
  document.getElementById("startDraftBtn").disabled = game.roster.length === 0;
}

function toggleSitOut(index) {
  if (game.started) return;
  const player = game.roster[index];
  game.setSitOut(player, !game.sitOuts.includes(player));
  renderLineup();
  populateLists(); // "Up next" is a live preview of the real queue
}

// Commit the roster and roll the locked slots. One-shot: the whole point of a
// random assignment is that it happens once, in front of everybody.
function startDraft() {
  if (game.started || game.roster.length === 0) return;
  game.start();
  updateTable();
  populateLists();
  applyPhase();
}

function resetToSetup() {
  if (
    game.started &&
    !confirm("Reset the draft? The board and ledger will be cleared.")
  ) {
    return;
  }
  // Keep the sit-outs — re-running a draft almost always means the same people
  // are still out. They can still be toggled before starting again.
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
    .map((player) => `<li>${player}</li>`)
    .join("");
  document.getElementById("movedPlayersList").innerHTML = game.movedPlayers
    .map((player) => `<li>${player}</li>`)
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

function setCardEffect(card, player) {
  const el = document.getElementById("cardEffect");
  if (!el) return;
  el.textContent =
    typeof card === "number"
      ? `${player} takes draft slot ${card}`
      : CARD_EFFECTS[card] || "";
}

function drawCard() {
  if (!game.started) return;
  const drawn = game.drawCard();
  if (!drawn) return;

  document.getElementById("mostRecentCard").textContent = `${drawn.card}`;
  if (typeof drawn.card !== "number") {
    document.getElementById("card").classList.add("specialCard");
  } else {
    document.getElementById("card").classList.remove("specialCard");
  }
  setCardEffect(drawn.card, drawn.player);

  // A finished draft leaves a partly dealt deck behind; start the next one
  // from a full deck.
  if (game.isFinished()) game.shuffle();

  updateTable();
  populateLists();
  applyPhase();
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
    nameDiv.textContent = `${game.playerSlots[idx] || ""}`; // Set the text content of the name div
    cell.appendChild(nameDiv); // Append the name div to the td
    // A locked cell reads as *settled*, not as *won*, so it takes .locked
    // instead of .filled rather than stacking both.
    const locked = game.isLocked(idx);
    cell.classList.toggle("filled", Boolean(game.playerSlots[idx]) && !locked);
    cell.classList.toggle("locked", locked);
    cell.title = locked
      ? `${game.playerSlots[idx]} sat out — this spot is locked`
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
        return `<span class="chip-locked">${player} <b>#${spot}</b></span>`;
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
