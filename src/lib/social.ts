/**
 * GhostFit — Social Layer (friends & challenges)
 *
 * Scores are always derived from ghost_sessions (the source of truth both
 * participants can read via RLS), never stored per-challenge — so they can't
 * drift from real workout data.
 */
import { supabase } from './supabase';
import {
  Challenge,
  ChallengeMetric,
  ChallengeScores,
  FriendInfo,
  FriendRequest,
} from './types';

async function uid(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

const PROFILE_COLS = 'character_name, character_style, aura_color, current_streak';

// ─── Friend codes ────────────────────────────────────────────────────────────

export async function getMyFriendCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_friend_code');
  if (error) {
    console.warn('ensure_friend_code failed:', error.message);
    return null;
  }
  return data as string;
}

export interface FoundUser {
  userId: string;
  characterName: string;
  characterStyle?: string;
  auraColor?: string;
}

export async function findByFriendCode(code: string): Promise<FoundUser | null> {
  const { data, error } = await supabase.rpc('find_by_friend_code', { code });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    userId: row.user_id,
    characterName: row.character_name ?? 'Fighter',
    characterStyle: row.character_style,
    auraColor: row.aura_color,
  };
}

// ─── Friendships ─────────────────────────────────────────────────────────────

export async function sendFriendRequest(toUserId: string): Promise<string | null> {
  const me = await uid();
  if (!me) return 'Not signed in';
  const { error } = await supabase.from('friendships').insert({
    requester_id: me,
    addressee_id: toUserId,
  });
  if (error) {
    if (error.code === '23505') return 'You already have a request or friendship with this fighter';
    return error.message;
  }
  return null; // success
}

export async function getFriendships(): Promise<{
  friends: FriendInfo[];
  requests: FriendRequest[];
}> {
  const me = await uid();
  if (!me) return { friends: [], requests: [] };

  const { data, error } = await supabase
    .from('friendships')
    .select(`id, requester_id, addressee_id, status,
      requester:profiles!requester_id(${PROFILE_COLS}),
      addressee:profiles!addressee_id(${PROFILE_COLS})`)
    .order('created_at', { ascending: false });

  if (error || !data) return { friends: [], requests: [] };

  const friends: FriendInfo[] = [];
  const requests: FriendRequest[] = [];

  for (const row of data) {
    const iAmRequester = row.requester_id === me;
    const otherId = iAmRequester ? row.addressee_id : row.requester_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const other = (iAmRequester ? row.addressee : row.requester) as any;
    const base = {
      userId: otherId,
      characterName: other?.character_name ?? 'Fighter',
      characterStyle: other?.character_style,
      auraColor: other?.aura_color,
    };
    if (row.status === 'accepted') {
      friends.push({ ...base, currentStreak: other?.current_streak ?? 0, friendshipId: row.id });
    } else {
      requests.push({ ...base, friendshipId: row.id, direction: iAmRequester ? 'outgoing' : 'incoming' });
    }
  }
  return { friends, requests };
}

export async function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId);
  return !error;
}

/** Decline a request, cancel an outgoing one, or unfriend. */
export async function removeFriendship(friendshipId: string): Promise<boolean> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  return !error;
}

// ─── Challenges ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToChallenge(row: any, me: string): Challenge {
  const iAmCreator = row.creator_id === me;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const other = (iAmCreator ? row.opponent : row.creator) as any;
  return {
    id: row.id,
    creatorId: row.creator_id,
    opponentId: row.opponent_id,
    metric: row.metric,
    durationDays: row.duration_days,
    wagerCoins: row.wager_coins ?? 0,
    status: row.status,
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : null,
    shadowBaseline: row.shadow_baseline ?? 0,
    winnerId: row.winner_id,
    creatorSettled: row.creator_settled ?? false,
    opponentSettled: row.opponent_settled ?? false,
    createdAt: new Date(row.created_at).getTime(),
    opponentProfile: row.opponent_id === null ? null : {
      characterName: other?.character_name ?? 'Fighter',
      characterStyle: other?.character_style,
      auraColor: other?.aura_color,
    },
  };
}

const CHALLENGE_SELECT = `*,
  creator:profiles!creator_id(character_name, character_style, aura_color),
  opponent:profiles!opponent_id(character_name, character_style, aura_color)`;

/**
 * Shadow baseline: the best score you ever posted in any rolling window of
 * `durationDays`, computed from full session history. 0 for first-timers —
 * their first challenge sets the bar.
 */
async function computeShadowBaseline(metric: ChallengeMetric, durationDays: number): Promise<number> {
  const me = await uid();
  if (!me) return 0;

  const { data } = await supabase
    .from('ghost_sessions')
    .select('date, total_reps, sets_completed')
    .eq('user_id', me)
    .order('date', { ascending: true });

  if (!data || data.length === 0) return 0;

  // Aggregate per calendar day
  const perDay = new Map<string, number>();
  for (const s of data) {
    const day = new Date(s.date).toDateString();
    const value = metric === 'total_reps' ? (s.total_reps ?? 0)
      : metric === 'sets' ? (s.sets_completed ?? 0)
      : 1; // workouts: counted once per day below
    if (metric === 'workouts') perDay.set(day, 1);
    else perDay.set(day, (perDay.get(day) ?? 0) + value);
  }

  const days = Array.from(perDay.entries())
    .map(([d, v]) => ({ time: new Date(d).getTime(), value: v }))
    .sort((a, b) => a.time - b.time);

  // Best sum over any rolling window of durationDays
  const windowMs = durationDays * 24 * 60 * 60 * 1000;
  let best = 0;
  let start = 0;
  let sum = 0;
  for (let end = 0; end < days.length; end++) {
    sum += days[end].value;
    while (days[end].time - days[start].time >= windowMs) {
      sum -= days[start].value;
      start++;
    }
    best = Math.max(best, sum);
  }
  return best;
}

export async function createFriendChallenge(opts: {
  opponentId: string;
  metric: ChallengeMetric;
  durationDays: number;
  wagerCoins: number;
}): Promise<string | null> {
  const me = await uid();
  if (!me) return 'Not signed in';

  const { error } = await supabase.from('challenges').insert({
    creator_id: me,
    opponent_id: opts.opponentId,
    metric: opts.metric,
    duration_days: opts.durationDays,
    wager_coins: opts.wagerCoins,
    status: 'pending',
  });
  if (error) return error.message;

  // Stake is escrowed up front; returned 2x on win, 1x on tie
  if (opts.wagerCoins > 0) {
    await supabase.rpc('add_soul_coins', { user_id: me, amount: -opts.wagerCoins });
  }
  return null;
}

export async function createShadowChallenge(opts: {
  metric: ChallengeMetric;
  durationDays: number;
  wagerCoins: number;
}): Promise<string | null> {
  const me = await uid();
  if (!me) return 'Not signed in';

  const baseline = await computeShadowBaseline(opts.metric, opts.durationDays);
  const now = new Date();
  const ends = new Date(now.getTime() + opts.durationDays * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from('challenges').insert({
    creator_id: me,
    opponent_id: null,
    metric: opts.metric,
    duration_days: opts.durationDays,
    wager_coins: opts.wagerCoins,
    status: 'active',
    starts_at: now.toISOString(),
    ends_at: ends.toISOString(),
    shadow_baseline: baseline,
  });
  if (error) return error.message;

  if (opts.wagerCoins > 0) {
    await supabase.rpc('add_soul_coins', { user_id: me, amount: -opts.wagerCoins });
  }
  return null;
}

export async function respondToChallenge(challenge: Challenge, accept: boolean): Promise<boolean> {
  const me = await uid();
  if (!me) return false;

  if (!accept) {
    const { error } = await supabase
      .from('challenges')
      .update({ status: 'declined' })
      .eq('id', challenge.id);
    return !error;
  }

  const now = new Date();
  const ends = new Date(now.getTime() + challenge.durationDays * 24 * 60 * 60 * 1000);
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'active', starts_at: now.toISOString(), ends_at: ends.toISOString() })
    .eq('id', challenge.id);
  if (error) return false;

  if (challenge.wagerCoins > 0) {
    await supabase.rpc('add_soul_coins', { user_id: me, amount: -challenge.wagerCoins });
  }
  return true;
}

function aggregate(metric: ChallengeMetric, rows: { date: string; total_reps: number | null; sets_completed: number | null }[]): number {
  if (metric === 'workouts') {
    return new Set(rows.map(r => new Date(r.date).toDateString())).size;
  }
  const key = metric === 'total_reps' ? 'total_reps' : 'sets_completed';
  return rows.reduce((sum, r) => sum + (r[key] ?? 0), 0);
}

export async function getChallengeScores(challenge: Challenge): Promise<ChallengeScores> {
  const me = await uid();
  if (!me || !challenge.startsAt) return { mine: 0, theirs: challenge.shadowBaseline };

  const startIso = new Date(challenge.startsAt).toISOString();
  const endIso = new Date(challenge.endsAt ?? Date.now()).toISOString();

  async function scoreFor(userId: string): Promise<number> {
    const { data } = await supabase
      .from('ghost_sessions')
      .select('date, total_reps, sets_completed')
      .eq('user_id', userId)
      .gte('date', startIso)
      .lte('date', endIso);
    return aggregate(challenge.metric, data ?? []);
  }

  const mine = await scoreFor(me);
  if (challenge.opponentId === null) {
    return { mine, theirs: challenge.shadowBaseline };
  }
  const otherId = challenge.creatorId === me ? challenge.opponentId : challenge.creatorId;
  const theirs = await scoreFor(otherId);
  return { mine, theirs };
}

export interface Verdict {
  challenge: Challenge;
  scores: ChallengeScores;
  outcome: 'win' | 'loss' | 'tie';
  coinsDelta: number;
}

/**
 * Fetch all challenges; finalize any that have expired; pay out this user's
 * side of any completed-but-unsettled challenge exactly once. Returns fresh
 * challenges plus verdicts to show full-screen.
 */
export async function syncChallenges(): Promise<{ challenges: Challenge[]; verdicts: Verdict[] }> {
  const me = await uid();
  if (!me) return { challenges: [], verdicts: [] };

  const { data, error } = await supabase
    .from('challenges')
    .select(CHALLENGE_SELECT)
    .order('created_at', { ascending: false });

  if (error || !data) return { challenges: [], verdicts: [] };

  const challenges = data.map(row => rowToChallenge(row, me));
  const verdicts: Verdict[] = [];
  const now = Date.now();

  for (const c of challenges) {
    const iAmCreator = c.creatorId === me;
    const mySettledFlag = iAmCreator ? 'creator_settled' : 'opponent_settled';
    const alreadySettled = iAmCreator ? c.creatorSettled : c.opponentSettled;

    // 1. Finalize expired active challenges
    if (c.status === 'active' && c.endsAt && now > c.endsAt && !alreadySettled) {
      const scores = await getChallengeScores(c);
      const outcome: Verdict['outcome'] =
        scores.mine > scores.theirs ? 'win' : scores.mine < scores.theirs ? 'loss' : 'tie';
      const winnerId = outcome === 'win' ? me
        : outcome === 'tie' ? null
        : (c.opponentId === null ? null : (iAmCreator ? c.opponentId : c.creatorId));

      const coinsDelta = outcome === 'win' ? c.wagerCoins * 2
        : outcome === 'tie' ? c.wagerCoins
        : 0;

      const { error: updateErr } = await supabase
        .from('challenges')
        .update({ status: 'completed', winner_id: winnerId, [mySettledFlag]: true })
        .eq('id', c.id);

      if (!updateErr) {
        if (coinsDelta > 0) {
          await supabase.rpc('add_soul_coins', { user_id: me, amount: coinsDelta });
        }
        c.status = 'completed';
        c.winnerId = winnerId;
        verdicts.push({ challenge: c, scores, outcome, coinsDelta });
      }
      continue;
    }

    // 2. Opponent finalized it first — settle my side and show verdict
    if (c.status === 'completed' && !alreadySettled) {
      const scores = await getChallengeScores(c);
      const outcome: Verdict['outcome'] =
        c.winnerId === me ? 'win' : c.winnerId === null ? 'tie' : 'loss';
      const coinsDelta = outcome === 'win' ? c.wagerCoins * 2
        : outcome === 'tie' ? c.wagerCoins
        : 0;

      const { error: updateErr } = await supabase
        .from('challenges')
        .update({ [mySettledFlag]: true })
        .eq('id', c.id);

      if (!updateErr) {
        if (coinsDelta > 0) {
          await supabase.rpc('add_soul_coins', { user_id: me, amount: coinsDelta });
        }
        verdicts.push({ challenge: c, scores, outcome, coinsDelta });
      }
    }
  }

  return { challenges, verdicts };
}

export async function getMyUserId(): Promise<string | null> {
  return uid();
}
