import { useState, useEffect } from 'react';
import type { RoomView, Team } from '@alias/shared';
import { socket } from '../socket.js';
import { TEAM_COLORS } from './GameBoard.js';

interface Props {
  room: RoomView;
  playerId: string;
  currentWord: { word: string; index: number; total: number } | null;
  lastWordResult: { word: string; status: 'guessed' | 'skipped' | 'stolen'; scoreChange: number; stolenByTeamName?: string } | null;
}

export function TurnActiveScreen({ room, playerId, currentWord, lastWordResult }: Props) {
  const turn = room.currentTurn;
  if (!turn) return null;

  const player = room.players[playerId];
  const isDescriber = turn.describerId === playerId;
  const isOnActiveTeam = player?.teamId === turn.teamId;
  const canSteal = !isOnActiveTeam && !!player?.teamId && turn.isStealTurn;

  const describer = room.players[turn.describerId ?? ''];
  const team = room.teams.find(t => t.teamId === turn.teamId);
  const teamIdx = room.teams.findIndex(t => t.teamId === turn.teamId);
  const teamColor = TEAM_COLORS[teamIdx % 6]!;

  const isStealVote = turn.status === 'steal_vote';

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.ceil((turn.endsAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((turn.endsAt - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(id);
  }, [turn.endsAt]);

  // Steal cooldown — prevent spam tapping
  const [stealCooldown, setStealCooldown] = useState(false);
  function handleSteal() {
    if (stealCooldown) return;
    socket.emit('turn:steal');
    setStealCooldown(true);
    setTimeout(() => setStealCooldown(false), 1000);
  }

  const totalSecs = room.settings.turnDurationSeconds;
  const timerPct = (secondsLeft / totalSecs) * 100;
  const timerCritical = secondsLeft <= 10;
  const timerWarning = secondsLeft <= 20;

  // ── Steal-vote overlay ────────────────────────────────────────────────────────
  if (isStealVote) {
    return (
      <StealVoteScreen
        turn={turn}
        team={team}
        teamColor={teamColor}
        secondsLeft={secondsLeft}
        isOnActiveTeam={isOnActiveTeam}
        canSteal={!isOnActiveTeam && !!player?.teamId}
        stealCooldown={stealCooldown}
        onSteal={handleSteal}
        scores={room.teams}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Timer bar */}
      <div className="h-1.5 bg-zinc-900 w-full">
        <div
          className="h-full transition-all duration-200"
          style={{
            width: `${timerPct}%`,
            backgroundColor: timerCritical ? '#ef4444' : timerWarning ? '#f59e0b' : teamColor.token,
          }}
        />
      </div>

      {/* Header strip */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e293b' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: teamColor.token }}>
            {team?.name}
          </p>
          <p className="text-xs text-zinc-400">
            {isDescriber ? 'אתה מתאר' : `${describer?.name ?? '?'} מתאר`}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`text-3xl font-black tabular-nums ${timerCritical ? 'animate-pulse' : ''}`}
            style={{ color: timerCritical ? '#ef4444' : timerWarning ? '#f59e0b' : '#fff' }}
          >
            {secondsLeft}
          </span>
          <p className="text-[10px] text-zinc-600">שנ'</p>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">

        {/* ── DESCRIBER VIEW ── */}
        {isDescriber && currentWord && (
          <div className="w-full max-w-sm space-y-4">
            <p className="text-center text-zinc-500 text-xs">
              {currentWord.index + 1} / {currentWord.total}
            </p>

            {/* Word card */}
            <div
              className="rounded-3xl p-8 text-center"
              style={{
                background: `linear-gradient(135deg, ${teamColor.bg}, #0f172a)`,
                border: `2px solid ${teamColor.border}`,
                boxShadow: `0 0 40px ${teamColor.glow}`,
              }}
            >
              <p className="text-4xl font-black capitalize tracking-wide leading-tight">
                {currentWord.word}
              </p>
            </div>

            {/* Result flash */}
            {lastWordResult && (
              <ResultFlash result={lastWordResult} />
            )}

            {/* Guess / Skip */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onPointerDown={() => socket.emit('turn:skipped')}
                disabled={secondsLeft === 0}
                className="py-5 rounded-2xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-30"
                style={{ background: '#1e293b', color: '#94a3b8' }}
              >
                דלג
              </button>
              <button
                onPointerDown={() => socket.emit('turn:guessed')}
                disabled={secondsLeft === 0}
                className="py-5 rounded-2xl font-bold text-lg active:scale-95 transition-transform disabled:opacity-30"
                style={{ background: '#166534', color: '#4ade80', border: '1px solid #16a34a' }}
              >
                נוחש!
              </button>
            </div>
          </div>
        )}

        {isDescriber && !currentWord && (
          <p className="text-zinc-500 text-sm">טוען…</p>
        )}

        {/* Steal warning for describer */}
        {isDescriber && turn.isStealTurn && (
          <div style={{
            background: '#78350f40',
            border: '1px solid #d9770660',
            borderRadius: '12px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '360px',
            width: '100%',
          }}>
            <span style={{ fontSize: '16px' }}>⚔</span>
            <p style={{ color: '#fbbf24', fontSize: '11px', margin: 0 }}>
              תא גנבייה — קבוצות אחרות יכולות לגנוב את המילים שלך!
            </p>
          </div>
        )}

        {/* ── SPECTATOR / TEAM VIEW ── */}
        {!isDescriber && (
          <div className="w-full max-w-sm space-y-5">
            {/* Mystery card */}
            <div
              className="rounded-3xl p-8 text-center space-y-2"
              style={{
                background: '#0f172a',
                border: `1px solid ${teamColor.border}40`,
              }}
            >
              <p className="text-zinc-500 text-sm">
                {describer?.name ?? 'המתאר'} מתאר…
              </p>
              <p className="text-5xl tracking-widest text-zinc-700">• • •</p>
              {isOnActiveTeam && (
                <p className="text-zinc-400 text-sm font-medium">צעקו את התשובה!</p>
              )}
            </div>

            {/* Result flash for spectators */}
            {lastWordResult && (
              <ResultFlash result={lastWordResult} />
            )}

            {/* Guessed count */}
            <p className="text-center text-zinc-500 text-sm">
              {turn.guessedCount} {turn.guessedCount === 1 ? 'מילה נוחשה' : 'מילים נוחשו'}
              {turn.stolenCount > 0 && ` · ${turn.stolenCount} נגנבו`}
            </p>

            {/* ── STEAL CELL BANNER ── */}
            {turn.isStealTurn && (
              <div style={{
                background: '#78350f40',
                border: '1px solid #d9770660',
                borderRadius: '12px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '18px' }}>⚔</span>
                <div>
                  <p style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 700, margin: 0 }}>
                    תא גנבייה
                  </p>
                  <p style={{ color: '#9a7040', fontSize: '11px', margin: 0 }}>
                    {isOnActiveTeam
                      ? 'קבוצות אחרות יכולות לגנוב מילים בתור זה!'
                      : 'תוכלו לגנוב מילים מקבוצה זו!'}
                  </p>
                </div>
              </div>
            )}

            {/* ── STEAL BUTTON ── */}
            {canSteal && (
              <div className="space-y-1">
                <button
                  onPointerDown={handleSteal}
                  disabled={stealCooldown}
                  className="w-full py-4 rounded-2xl font-black text-xl active:scale-95 transition-transform disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #78350f, #92400e)',
                    border: '1px solid #d97706',
                    color: '#fbbf24',
                    boxShadow: stealCooldown ? 'none' : '0 0 20px #d9770644',
                  }}
                >
                  ⚔ גנוב!
                </button>
                <p className="text-center text-[10px] text-zinc-600">
                  לחצו אם אתם יודעים את המילה לפניהם
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Score strip */}
      <div style={{ borderTop: '1px solid #1e293b' }} className="px-4 py-2.5 flex gap-5 overflow-x-auto">
        {room.teams.map((t, idx) => {
          const c = TEAM_COLORS[idx % 6]!;
          const isActive = t.teamId === turn.teamId;
          return (
            <div key={t.teamId} className="flex items-center gap-1.5 shrink-0">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: c.token, opacity: isActive ? 1 : 0.5 }}
              />
              <span className="text-xs" style={{ color: isActive ? c.text : '#475569' }}>{t.name}</span>
              <span
                className="text-sm font-black tabular-nums"
                style={{ color: isActive ? '#fff' : '#64748b' }}
              >
                {t.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Steal vote screen ────────────────────────────────────────────────────────

type TurnView = NonNullable<RoomView['currentTurn']>;

function StealVoteScreen({
  turn, team, teamColor, secondsLeft, isOnActiveTeam, canSteal, stealCooldown, onSteal, scores,
}: {
  turn: TurnView;
  team: Team | undefined;
  teamColor: typeof TEAM_COLORS[number];
  secondsLeft: number;
  isOnActiveTeam: boolean;
  canSteal: boolean;
  stealCooldown: boolean;
  onSteal: () => void;
  scores: Team[];
}) {
  const word = turn.stealVoteWord;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Countdown bar — amber for steal vote */}
      <div className="h-1.5 bg-zinc-900 w-full">
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${(secondsLeft / 5) * 100}%`, backgroundColor: '#f59e0b' }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e293b' }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: teamColor.token }}>
            {team?.name}
          </p>
          <p className="text-xs text-amber-400 font-semibold">הזמן נגמר!</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black tabular-nums animate-pulse" style={{ color: '#f59e0b' }}>
            {secondsLeft}
          </span>
          <p className="text-[10px] text-zinc-600">שנ'</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 gap-5">
        <div className="w-full max-w-sm space-y-4">
          {/* Steal vote banner */}
          <div style={{
            background: '#78350f60',
            border: '1px solid #d97706',
            borderRadius: '16px',
            padding: '12px 16px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#fbbf24', fontWeight: 800, fontSize: '13px', margin: 0 }}>
              ⚔ הזדמנות גנבייה!
            </p>
            <p style={{ color: '#9a7040', fontSize: '11px', margin: '4px 0 0' }}>
              {isOnActiveTeam
                ? 'קבוצות אחרות יכולות לגנוב את המילה!'
                : 'גנבו את המילה האחרונה לפני שהזמן נגמר!'}
            </p>
          </div>

          {/* The contested word */}
          {word && (
            <div
              className="rounded-3xl p-8 text-center"
              style={{
                background: '#1c1410',
                border: '2px solid #d97706',
                boxShadow: '0 0 40px #d9770644',
              }}
            >
              <p className="text-xs text-amber-600 mb-2 uppercase tracking-wider">המילה האחרונה</p>
              <p className="text-4xl font-black capitalize tracking-wide">{word}</p>
            </div>
          )}

          {/* Steal button for non-active teams */}
          {canSteal && (
            <button
              onPointerDown={onSteal}
              disabled={stealCooldown}
              className="w-full py-5 rounded-2xl font-black text-2xl active:scale-95 transition-transform disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #78350f, #92400e)',
                border: '2px solid #d97706',
                color: '#fbbf24',
                boxShadow: stealCooldown ? 'none' : '0 0 30px #d9770666',
              }}
            >
              ⚔ גנוב!
            </button>
          )}

          {isOnActiveTeam && (
            <p className="text-center text-zinc-500 text-sm">
              ממתינים לראות אם קבוצה אחרת תגנוב…
            </p>
          )}
        </div>
      </div>

      {/* Score strip */}
      <div style={{ borderTop: '1px solid #1e293b' }} className="px-4 py-2.5 flex gap-5 overflow-x-auto">
        {scores.map((t, idx) => {
          const c = TEAM_COLORS[idx % 6]!;
          const isActive = t.teamId === turn.teamId;
          return (
            <div key={t.teamId} className="flex items-center gap-1.5 shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.token, opacity: isActive ? 1 : 0.5 }} />
              <span className="text-xs" style={{ color: isActive ? c.text : '#475569' }}>{t.name}</span>
              <span className="text-sm font-black tabular-nums" style={{ color: isActive ? '#fff' : '#64748b' }}>
                {t.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Result flash ─────────────────────────────────────────────────────────────

function ResultFlash({ result }: {
  result: { word: string; status: 'guessed' | 'skipped' | 'stolen'; scoreChange: number; stolenByTeamName?: string };
}) {
  const styles = {
    guessed: { color: '#4ade80', bg: '#052e1620', border: '#16a34a40', icon: '✓' },
    skipped: { color: '#64748b', bg: '#0f172a', border: '#1e293b', icon: '→' },
    stolen: { color: '#fbbf24', bg: '#451a0320', border: '#d9770640', icon: '🗡️' },
  };
  const s = styles[result.status];

  return (
    <div
      className="text-center py-2 px-4 rounded-xl text-sm font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.icon}{' '}
      {result.status === 'stolen'
        ? `"${result.word}" נגנבה על ידי ${result.stolenByTeamName}!`
        : result.status === 'guessed'
          ? `+1 — "${result.word}"`
          : `דולגה "${result.word}"`}
    </div>
  );
}
