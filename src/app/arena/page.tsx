'use client';
import BottomNav from '@/components/BottomNav';
import Celebration from '@/components/Celebration';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store/appStore';
import { getCharEmoji } from '@/lib/avatar';
import {
  Challenge, ChallengeMetric, ChallengeScores, FriendInfo, FriendRequest,
  METRIC_LABELS,
} from '@/lib/types';
import {
  acceptFriendRequest, createFriendChallenge, createShadowChallenge,
  findByFriendCode, FoundUser, getChallengeScores, getFriendships,
  getMyFriendCode, getMyUserId, removeFriendship, respondToChallenge,
  sendFriendRequest, syncChallenges, Verdict,
} from '@/lib/social';

const DURATIONS = [3, 7, 14];
const WAGERS = [0, 25, 50, 100];

function daysLeft(endsAt: number | null): string {
  if (!endsAt) return '';
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

export default function ArenaPage() {
  const { profile, refreshProfile } = useAppStore();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'challenges' | 'friends'>('challenges');
  const [myId, setMyId] = useState<string | null>(null);

  // Friends state
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [addCode, setAddCode] = useState('');
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [addStatus, setAddStatus] = useState<string | null>(null);

  // Challenges state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [scores, setScores] = useState<Record<string, ChallengeScores>>({});
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  // Create-challenge sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [oppPick, setOppPick] = useState<string>('shadow'); // 'shadow' | friend userId
  const [metricPick, setMetricPick] = useState<ChallengeMetric>('total_reps');
  const [durationPick, setDurationPick] = useState(7);
  const [wagerPick, setWagerPick] = useState(25);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [, id, code, fr, sync] = await Promise.all([
      refreshProfile(),
      getMyUserId(),
      getMyFriendCode(),
      getFriendships(),
      syncChallenges(),
    ]);
    setMyId(id);
    setMyCode(code);
    setFriends(fr.friends);
    setRequests(fr.requests);
    setChallenges(sync.challenges);
    setVerdicts(v => [...v, ...sync.verdicts]);

    const active = sync.challenges.filter(c => c.status === 'active');
    const scoreEntries = await Promise.all(
      active.map(async c => [c.id, await getChallengeScores(c)] as const)
    );
    setScores(Object.fromEntries(scoreEntries));
    setReady(true);
  }, [refreshProfile]);

  useEffect(() => { load(); }, [load]);

  async function handleFindUser() {
    setAddStatus(null);
    setFoundUser(null);
    if (addCode.trim().length < 4) { setAddStatus('Enter a friend code'); return; }
    const found = await findByFriendCode(addCode);
    if (!found) { setAddStatus('No fighter found with that code'); return; }
    setFoundUser(found);
  }

  async function handleSendRequest() {
    if (!foundUser) return;
    const err = await sendFriendRequest(foundUser.userId);
    if (err) { setAddStatus(err); return; }
    setAddStatus(`Challenge request sent to ${foundUser.characterName}! ⚔️`);
    setFoundUser(null);
    setAddCode('');
    const fr = await getFriendships();
    setRequests(fr.requests);
  }

  async function handleRespondRequest(req: FriendRequest, accept: boolean) {
    if (accept) await acceptFriendRequest(req.friendshipId);
    else await removeFriendship(req.friendshipId);
    const fr = await getFriendships();
    setFriends(fr.friends);
    setRequests(fr.requests);
  }

  async function handleCreateChallenge() {
    setCreateError(null);
    const coins = profile?.soulCoins ?? 0;
    if (wagerPick > coins) {
      setCreateError(`Not enough Soul Coins (you have ${coins})`);
      return;
    }
    setCreating(true);
    const opts = { metric: metricPick, durationDays: durationPick, wagerCoins: wagerPick };
    const err = oppPick === 'shadow'
      ? await createShadowChallenge(opts)
      : await createFriendChallenge({ ...opts, opponentId: oppPick });
    setCreating(false);
    if (err) { setCreateError(err); return; }
    setSheetOpen(false);
    await load();
  }

  async function handleRespondChallenge(c: Challenge, accept: boolean) {
    if (accept && c.wagerCoins > (profile?.soulCoins ?? 0)) return;
    await respondToChallenge(c, accept);
    await load();
  }

  function openChallengeSheet(preselect?: string) {
    setOppPick(preselect ?? (friends.length > 0 ? friends[0].userId : 'shadow'));
    setCreateError(null);
    setSheetOpen(true);
  }

  function copyCode() {
    if (!myCode) return;
    navigator.clipboard?.writeText(myCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    });
  }

  const pendingIncoming = challenges.filter(c => c.status === 'pending' && c.opponentId === myId);
  const pendingOutgoing = challenges.filter(c => c.status === 'pending' && c.creatorId === myId);
  const activeChallenges = challenges.filter(c => c.status === 'active');
  const pastChallenges = challenges.filter(c => c.status === 'completed').slice(0, 10);
  const incomingRequests = requests.filter(r => r.direction === 'incoming');
  const outgoingRequests = requests.filter(r => r.direction === 'outgoing');
  const verdict = verdicts[0] ?? null;

  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="ghost-loader" style={{ fontSize: 40 }}>⚔️</div>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Entering the arena...</p>
      </div>
    );
  }

  return (
    <>
      {verdict && (
        <div className="verdict-overlay">
          {verdict.outcome === 'win' && <Celebration big />}
          <div className={`verdict-card ${verdict.outcome}`}>
            <div className="verdict-emoji">
              {verdict.outcome === 'win' ? '🏆' : verdict.outcome === 'tie' ? '🤝' : '💀'}
            </div>
            <h2 className="verdict-title">
              {verdict.outcome === 'win' ? 'VICTORY' : verdict.outcome === 'tie' ? 'DRAW' : 'DEFEATED'}
            </h2>
            <p className="verdict-sub">
              {verdict.challenge.opponentId === null
                ? `vs Past You · ${METRIC_LABELS[verdict.challenge.metric]}`
                : `vs ${verdict.challenge.opponentProfile?.characterName} · ${METRIC_LABELS[verdict.challenge.metric]}`}
            </p>
            <div className="verdict-scores">
              <div>
                <span className="verdict-score-num">{verdict.scores.mine}</span>
                <span className="verdict-score-label">YOU</span>
              </div>
              <span className="verdict-vs">—</span>
              <div>
                <span className="verdict-score-num">{verdict.scores.theirs}</span>
                <span className="verdict-score-label">
                  {verdict.challenge.opponentId === null ? 'PAST YOU' : 'THEM'}
                </span>
              </div>
            </div>
            {verdict.coinsDelta > 0 && (
              <p className="verdict-coins">+{verdict.coinsDelta} Soul Coins 🪙</p>
            )}
            {verdict.outcome === 'loss' && verdict.challenge.wagerCoins > 0 && (
              <p className="verdict-coins loss">−{verdict.challenge.wagerCoins} Soul Coins staked</p>
            )}
            <button className="btn-primary" onClick={() => setVerdicts(v => v.slice(1))}>
              {verdict.outcome === 'loss' ? 'REMATCH TIME' : 'CLAIM GLORY'}
            </button>
          </div>
        </div>
      )}

      <header className="hdr">
        <Link href="/" className="hdr-back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <span className="hdr-logo">⚔️ ARENA</span>
        <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>🪙 {profile?.soulCoins ?? 0}</span>
      </header>

      <div className="arena-tabs">
        <button className={`arena-tab ${tab === 'challenges' ? 'active' : ''}`} onClick={() => setTab('challenges')}>
          CHALLENGES {pendingIncoming.length > 0 && <span className="arena-badge">{pendingIncoming.length}</span>}
        </button>
        <button className={`arena-tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => setTab('friends')}>
          FRIENDS {incomingRequests.length > 0 && <span className="arena-badge">{incomingRequests.length}</span>}
        </button>
      </div>

      {tab === 'challenges' && (
        <div className="arena-body">
          <button className="btn-primary" onClick={() => openChallengeSheet()}>
            + NEW CHALLENGE
          </button>

          {pendingIncoming.map(c => (
            <div className="arena-card pending" key={c.id}>
              <div className="arena-card-head">
                <span className="arena-avatar" style={{ borderColor: c.opponentProfile?.auraColor ?? 'var(--accent)' }}>
                  {getCharEmoji(c.opponentProfile?.characterStyle ?? 'warrior')}
                </span>
                <div>
                  <strong>{c.opponentProfile?.characterName ?? 'Fighter'}</strong> challenges you!
                  <p className="arena-card-sub">
                    {METRIC_LABELS[c.metric]} · {c.durationDays} days
                    {c.wagerCoins > 0 && ` · 🪙 ${c.wagerCoins} stake`}
                  </p>
                </div>
              </div>
              {c.wagerCoins > (profile?.soulCoins ?? 0) && (
                <p className="arena-error">You need 🪙 {c.wagerCoins} to accept this stake</p>
              )}
              <div className="arena-actions">
                <button
                  className="arena-btn accept"
                  disabled={c.wagerCoins > (profile?.soulCoins ?? 0)}
                  onClick={() => handleRespondChallenge(c, true)}
                >ACCEPT ⚔️</button>
                <button className="arena-btn decline" onClick={() => handleRespondChallenge(c, false)}>DECLINE</button>
              </div>
            </div>
          ))}

          {activeChallenges.map(c => {
            const s = scores[c.id] ?? { mine: 0, theirs: c.shadowBaseline };
            const max = Math.max(s.mine, s.theirs, 1);
            const isShadow = c.opponentId === null;
            const oppName = isShadow ? 'PAST YOU' : (c.opponentProfile?.characterName ?? 'Fighter');
            return (
              <div className="arena-card" key={c.id}>
                <div className="arena-card-top">
                  <span className="arena-metric">{METRIC_LABELS[c.metric]}</span>
                  <span className="arena-timer">{daysLeft(c.endsAt)}</span>
                </div>
                <div className="arena-race">
                  <div className="arena-race-row">
                    <span className="arena-race-name you">{profile?.characterName ?? 'YOU'}</span>
                    <div className="arena-race-track">
                      <div className="arena-race-fill you" style={{ width: `${(s.mine / max) * 100}%` }} />
                    </div>
                    <span className="arena-race-score">{s.mine}</span>
                  </div>
                  <div className="arena-race-row">
                    <span className="arena-race-name them">{oppName}</span>
                    <div className="arena-race-track">
                      <div
                        className="arena-race-fill them"
                        style={{
                          width: `${(s.theirs / max) * 100}%`,
                          background: isShadow ? '#8B5CF6' : (c.opponentProfile?.auraColor ?? '#FF4444'),
                        }}
                      />
                    </div>
                    <span className="arena-race-score">{s.theirs}</span>
                  </div>
                </div>
                <p className="arena-card-sub" style={{ textAlign: 'center' }}>
                  {s.mine > s.theirs
                    ? (isShadow ? "You're beating your best self 🔥" : `You're ahead — keep the pressure on 🔥`)
                    : s.mine === s.theirs
                      ? 'Dead even. Next workout decides it.'
                      : (isShadow ? 'Past You is winning. Unacceptable.' : `${oppName} is ahead. Time to answer.`)}
                  {c.wagerCoins > 0 && ` · 🪙 ${c.wagerCoins * 2} pot`}
                </p>
              </div>
            );
          })}

          {pendingOutgoing.map(c => (
            <div className="arena-card waiting" key={c.id}>
              <p className="arena-card-sub">
                ⏳ Waiting for <strong>{c.opponentProfile?.characterName ?? 'Fighter'}</strong> to accept ·{' '}
                {METRIC_LABELS[c.metric]} · {c.durationDays}d
                {c.wagerCoins > 0 && ` · 🪙 ${c.wagerCoins}`}
              </p>
            </div>
          ))}

          {activeChallenges.length === 0 && pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
            <div className="arena-empty">
              <div style={{ fontSize: 44 }}>⚔️</div>
              <h3>No battles running</h3>
              <p>Challenge a friend — or your own best self — and make this week count.</p>
            </div>
          )}

          {pastChallenges.length > 0 && (
            <>
              <h4 className="arena-section-title">PAST BATTLES</h4>
              {pastChallenges.map(c => {
                const won = c.winnerId === myId;
                const tie = c.winnerId === null;
                return (
                  <div className="arena-past" key={c.id}>
                    <span>{won ? '🏆' : tie ? '🤝' : '💀'}</span>
                    <span className="arena-past-name">
                      vs {c.opponentId === null ? 'Past You' : (c.opponentProfile?.characterName ?? 'Fighter')}
                    </span>
                    <span className="arena-past-meta">{METRIC_LABELS[c.metric]}</span>
                    <span className={`arena-past-result ${won ? 'win' : tie ? '' : 'loss'}`}>
                      {won ? 'WON' : tie ? 'DRAW' : 'LOST'}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div className="arena-body">
          <div className="arena-card code-card">
            <p className="arena-card-sub">YOUR FRIEND CODE</p>
            <div className="arena-code-row">
              <span className="arena-code">{myCode ?? '······'}</span>
              <button className="arena-btn accept" onClick={copyCode}>
                {codeCopied ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
            <p className="arena-card-sub">Share it — friends enter it below to link up.</p>
          </div>

          <div className="arena-card">
            <p className="arena-card-sub">ADD A FRIEND</p>
            <div className="arena-code-row">
              <input
                className="arena-input"
                placeholder="ENTER CODE"
                value={addCode}
                maxLength={8}
                onChange={e => { setAddCode(e.target.value.toUpperCase()); setFoundUser(null); setAddStatus(null); }}
                onKeyDown={e => e.key === 'Enter' && handleFindUser()}
              />
              <button className="arena-btn accept" onClick={handleFindUser}>FIND</button>
            </div>
            {addStatus && <p className="arena-card-sub" style={{ marginTop: 8 }}>{addStatus}</p>}
            {foundUser && (
              <div className="arena-found">
                <span className="arena-avatar" style={{ borderColor: foundUser.auraColor ?? 'var(--accent)' }}>
                  {getCharEmoji(foundUser.characterStyle ?? 'warrior')}
                </span>
                <strong>{foundUser.characterName}</strong>
                <button className="arena-btn accept" onClick={handleSendRequest}>SEND REQUEST</button>
              </div>
            )}
          </div>

          {incomingRequests.length > 0 && (
            <>
              <h4 className="arena-section-title">REQUESTS</h4>
              {incomingRequests.map(r => (
                <div className="arena-card pending" key={r.friendshipId}>
                  <div className="arena-card-head">
                    <span className="arena-avatar" style={{ borderColor: r.auraColor ?? 'var(--accent)' }}>
                      {getCharEmoji(r.characterStyle ?? 'warrior')}
                    </span>
                    <div>
                      <strong>{r.characterName}</strong> wants to be rivals
                    </div>
                  </div>
                  <div className="arena-actions">
                    <button className="arena-btn accept" onClick={() => handleRespondRequest(r, true)}>ACCEPT</button>
                    <button className="arena-btn decline" onClick={() => handleRespondRequest(r, false)}>DECLINE</button>
                  </div>
                </div>
              ))}
            </>
          )}

          <h4 className="arena-section-title">YOUR RIVALS ({friends.length})</h4>
          {friends.length === 0 && (
            <div className="arena-empty">
              <div style={{ fontSize: 44 }}>👥</div>
              <h3>No rivals yet</h3>
              <p>Share your code above. Until then, your toughest opponent is Past You — challenge them anytime.</p>
            </div>
          )}
          {friends.map(f => (
            <div className="arena-friend" key={f.friendshipId}>
              <span className="arena-avatar" style={{ borderColor: f.auraColor ?? 'var(--accent)' }}>
                {getCharEmoji(f.characterStyle ?? 'warrior')}
              </span>
              <div className="arena-friend-info">
                <strong>{f.characterName}</strong>
                <span className="arena-card-sub">{f.currentStreak > 0 ? `${f.currentStreak} day streak 🔥` : 'No streak — easy prey'}</span>
              </div>
              <button
                className="arena-btn accept"
                onClick={() => { setTab('challenges'); openChallengeSheet(f.userId); }}
              >⚔️ FIGHT</button>
            </div>
          ))}

          {outgoingRequests.length > 0 && (
            <>
              <h4 className="arena-section-title">SENT</h4>
              {outgoingRequests.map(r => (
                <div className="arena-past" key={r.friendshipId}>
                  <span>⏳</span>
                  <span className="arena-past-name">{r.characterName}</span>
                  <button className="arena-btn decline" onClick={() => handleRespondRequest(r, false)}>CANCEL</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {sheetOpen && (
        <div className="sheet-overlay" onClick={() => setSheetOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 className="sheet-title">NEW CHALLENGE</h3>

            <p className="sheet-label">OPPONENT</p>
            <div className="sheet-options">
              <button
                className={`sheet-opt ${oppPick === 'shadow' ? 'active' : ''}`}
                onClick={() => setOppPick('shadow')}
              >👻 Past You</button>
              {friends.map(f => (
                <button
                  key={f.userId}
                  className={`sheet-opt ${oppPick === f.userId ? 'active' : ''}`}
                  onClick={() => setOppPick(f.userId)}
                >{getCharEmoji(f.characterStyle ?? 'warrior')} {f.characterName}</button>
              ))}
            </div>
            {oppPick === 'shadow' && (
              <p className="arena-card-sub">You race the best {durationPick}-day run you&apos;ve ever posted. Beat your own record.</p>
            )}

            <p className="sheet-label">BATTLE METRIC</p>
            <div className="sheet-options">
              {(Object.keys(METRIC_LABELS) as ChallengeMetric[]).map(m => (
                <button
                  key={m}
                  className={`sheet-opt ${metricPick === m ? 'active' : ''}`}
                  onClick={() => setMetricPick(m)}
                >{METRIC_LABELS[m]}</button>
              ))}
            </div>

            <p className="sheet-label">DURATION</p>
            <div className="sheet-options">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  className={`sheet-opt ${durationPick === d ? 'active' : ''}`}
                  onClick={() => setDurationPick(d)}
                >{d} days</button>
              ))}
            </div>

            <p className="sheet-label">SOUL COIN STAKE (winner takes double)</p>
            <div className="sheet-options">
              {WAGERS.map(w => (
                <button
                  key={w}
                  className={`sheet-opt ${wagerPick === w ? 'active' : ''} ${w > (profile?.soulCoins ?? 0) ? 'disabled' : ''}`}
                  disabled={w > (profile?.soulCoins ?? 0)}
                  onClick={() => setWagerPick(w)}
                >{w === 0 ? 'For honor' : `🪙 ${w}`}</button>
              ))}
            </div>

            {createError && <p className="arena-error">{createError}</p>}
            <button className="btn-primary" disabled={creating} onClick={handleCreateChallenge} style={{ marginTop: 16 }}>
              {creating ? 'SUMMONING...' : oppPick === 'shadow' ? 'FIGHT YOUR PAST 👻' : 'SEND CHALLENGE ⚔️'}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="arena" />
    </>
  );
}
