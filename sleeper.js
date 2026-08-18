// Sleeper auto-sync for All-In.
//
// Pulls a league's members straight from Sleeper's public REST API so the
// draft-order game can be seeded with the real drafters instead of typing
// every name by hand. All endpoints here are the public, unauthenticated
// ones (`/v1/league/...`, `/v1/user/...`) and Sleeper serves them with
// permissive CORS, so this works entirely client-side — no backend, no key.
//
// Mirrors the read-only endpoints used by the New FF `tools/sleeper.py`
// wrapper: get_league, get_users, get_user, get_user_leagues.

const SLEEPER_BASE = "https://api.sleeper.app/v1";

// The season whose leagues we look up when the user gives a username rather
// than a league id. Drafts happen pre-season, so "this calendar year" is the
// right default; overridable from the UI if needed.
const DEFAULT_SEASON = new Date().getFullYear();

async function sleeperGet(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Sleeper request failed (HTTP ${res.status})`);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// One unretried GET /league/<id>. Returns the league payload, or null when
// the id isn't a league (Sleeper answers with a 404 or a 200 carrying null).
// This is the disambiguation probe: a numeric id could be a league id or a
// user id, so we try league first.
async function probeLeague(leagueId) {
  const data = await sleeperGet(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}`);
  if (data && typeof data === "object" && data.league_id) return data;
  return null;
}

// Resolve a username (or user id) to a Sleeper user object. Returns null if
// no such user exists.
async function resolveUser(usernameOrId) {
  const data = await sleeperGet(`${SLEEPER_BASE}/user/${encodeURIComponent(usernameOrId)}`);
  if (data && typeof data === "object" && data.user_id) return data;
  return null;
}

// Every league a user is in for a given season.
async function userLeagues(userId, season) {
  const data = await sleeperGet(
    `${SLEEPER_BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${season}`
  );
  return Array.isArray(data) ? data : [];
}

// The members of a league, shaped for the game: a stable id, a display name,
// and the raw team name (used as a subtitle when present).
async function leagueMembers(leagueId) {
  const users = await sleeperGet(`${SLEEPER_BASE}/league/${encodeURIComponent(leagueId)}/users`);
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("That league has no members to sync.");
  }
  return users.map((u) => {
    const teamName = u.metadata && u.metadata.team_name ? u.metadata.team_name.trim() : "";
    const name = (u.display_name && u.display_name.trim()) || teamName || u.user_id;
    const avatar = (u.metadata && u.metadata.avatar) || u.avatar || "";
    const avatarUrl = avatar
      ? avatar.startsWith("http")
        ? avatar
        : `https://sleepercdn.com/avatars/thumbs/${avatar}`
      : "";
    return { id: u.user_id, name, teamName, avatarUrl };
  });
}

// High-level entry point used by the UI.
//
// `input` is whatever the user typed: a league id, a username, or a user id.
// Resolution order:
//   1. Treat it as a league id and probe it.
//   2. Otherwise resolve it as a user, and look up their leagues for the
//      season. Zero leagues -> error. One league -> use it. Many -> hand the
//      list back so the caller can let the user pick.
//
// Returns one of:
//   { kind: "members", leagueName, members }               // ready to seed
//   { kind: "choose-league", leagues: [{league_id, name}] } // needs a pick
async function syncFromSleeper(input, season = DEFAULT_SEASON) {
  const query = (input || "").trim();
  if (!query) throw new Error("Enter a Sleeper league id or username first.");

  const league = await probeLeague(query);
  if (league) {
    return {
      kind: "members",
      leagueName: league.name || "Sleeper league",
      members: await leagueMembers(league.league_id),
    };
  }

  const user = await resolveUser(query);
  if (!user) {
    throw new Error(`No Sleeper league or user found for "${query}".`);
  }

  const leagues = await userLeagues(user.user_id, season);
  if (leagues.length === 0) {
    throw new Error(
      `${user.display_name || query} isn't in any ${season} NFL leagues on Sleeper.`
    );
  }
  if (leagues.length === 1) {
    return {
      kind: "members",
      leagueName: leagues[0].name || "Sleeper league",
      members: await leagueMembers(leagues[0].league_id),
    };
  }
  return {
    kind: "choose-league",
    leagues: leagues.map((l) => ({ league_id: l.league_id, name: l.name || l.league_id })),
  };
}
