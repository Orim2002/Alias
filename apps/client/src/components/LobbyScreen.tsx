import { useState } from 'react';
import type { RoomView, GameSettings, AckResponse } from '@alias/shared';
import { socket } from '../socket.js';
import { GameBoard, TEAM_COLORS } from './GameBoard.js';
import { HowToPlayModal } from './HowToPlayModal.js';

const MAX_TEAMS = 6;

interface Props {
  room: RoomView;
  playerId: string;
}

export function LobbyScreen({ room, playerId }: Props) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [showRules, setShowRules] = useState(false);

  const isHost = room.hostId === playerId;
  const myTeamId = room.players[playerId]?.teamId ?? null;
  const unassigned = Object.values(room.players).filter(p => p.teamId === null);
  const teamsWithPlayers = room.teams.filter(t => t.playerIds.length > 0);
  const canStart = isHost && teamsWithPlayers.length >= 2;

  function assignToTeam(targetPlayerId: string, teamIndex: number) {
    socket.emit('room:assign_team', { targetPlayerId, teamIndex });
  }

  function handleStart() {
    setStartError('');
    setStarting(true);
    socket.emit('room:start', (res: AckResponse<null>) => {
      setStarting(false);
      if (!res.ok) setStartError(res.error);
    });
  }

  function updateSetting(patch: Partial<GameSettings>) {
    socket.emit('room:update_settings', patch);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-3 sm:p-4 max-w-2xl mx-auto space-y-5 pb-16">
      {showRules && <HowToPlayModal onClose={() => setShowRules(false)} />}

      {/* Header */}
      <div className="pt-6 pb-2 flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-widest">קוד חדר</p>
          <h2 className="text-4xl font-black font-mono tracking-widest text-indigo-400">{room.roomCode}</h2>
          <p className="text-zinc-500 text-xs mt-1">שתפו את הקוד עם חברים להצטרף</p>
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="mt-2 text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors text-zinc-400 hover:text-white"
        >
          ? איך משחקים
        </button>
      </div>

      {/* Board preview */}
      <section className="space-y-2">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wide">לוח</h3>
        <GameBoard teams={room.teams} targetScore={room.settings.targetScore} />
      </section>

      {/* Teams */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wide">
            קבוצות ({room.teams.length}/{MAX_TEAMS})
          </h3>
          {isHost && (
            <div className="flex gap-2">
              {room.teams.length > 2 && (
                <button
                  onClick={() => socket.emit('room:remove_team')}
                  className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-red-900 rounded-lg transition-colors"
                >
                  − הסר
                </button>
              )}
              {room.teams.length < MAX_TEAMS && (
                <button
                  onClick={() => socket.emit('room:add_team')}
                  className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  + הוסף קבוצה
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {room.teams.map((team, teamIdx) => {
            const c = TEAM_COLORS[teamIdx % 6]!;
            const members = team.playerIds.map(id => room.players[id]).filter(Boolean);
            const isMine = team.teamId === myTeamId;

            return (
              <div
                key={team.teamId}
                className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-3"
                style={isMine ? { borderColor: c.border } : {}}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.token }} />
                  {isHost
                    ? <TeamNameInput
                        value={team.name}
                        color={c.text}
                        onChange={name => socket.emit('room:rename_team', { teamIndex: teamIdx, name })}
                      />
                    : <h4 className="font-bold" style={{ color: c.text }}>{team.name}</h4>
                  }
                  <span className="text-xs text-zinc-500 ml-auto shrink-0">{members.length} שח'</span>
                </div>

                <div className="space-y-1 min-h-[1.5rem]">
                  {members.length === 0 && (
                    <p className="text-zinc-600 text-xs italic">אין שחקנים עדיין</p>
                  )}
                  {members.map(p => (
                    <div key={p!.playerId} className="flex items-center justify-between text-sm">
                      <span>
                        {p!.name}
                        {p!.playerId === playerId && (
                          <span className="text-zinc-500 text-xs mr-1">(אתה)</span>
                        )}
                      </span>
                      {isHost && p!.playerId !== room.hostId && (
                        <button
                          onClick={() => {
                            const nextIdx = (teamIdx + 1) % room.teams.length;
                            assignToTeam(p!.playerId, nextIdx);
                          }}
                          className="text-xs text-zinc-500 hover:text-white transition-colors"
                        >
                          העבר →
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Join button */}
                {!isMine && (
                  <button
                    onClick={() => assignToTeam(playerId, teamIdx)}
                    className="w-full text-xs py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    הצטרף ל{team.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wide">
            לא בקבוצה עדיין
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(p => (
              <div key={p.playerId} className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
                <span className="text-sm">{p.name}{p.playerId === playerId ? ' (אתה)' : ''}</span>
                {isHost && (
                  <div className="flex gap-1">
                    {room.teams.map((t, idx) => (
                      <button
                        key={t.teamId}
                        onClick={() => assignToTeam(p.playerId, idx)}
                        className="text-[10px] px-2 py-1 rounded-lg bg-zinc-700 hover:bg-indigo-600 transition-colors"
                      >
                        → {t.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Settings */}
      {isHost && (
        <section className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 space-y-4">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wide">הגדרות</h3>

          {/* Target score */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-zinc-300">ניקוד יעד</label>
              <p className="text-xs text-zinc-500">הקבוצה הראשונה שמגיעה לכאן מנצחת</p>
            </div>
            <div className="flex items-center gap-2">
              {([20, 30, 40, 50, 60] as const).map(v => (
                <button
                  key={v}
                  onClick={() => updateSetting({ targetScore: v })}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-mono transition-colors ${
                    room.settings.targetScore === v
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Turn duration */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-300">משך תור</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateSetting({ turnDurationSeconds: Math.max(15, room.settings.turnDurationSeconds - 15) })}
                className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-lg font-bold transition-colors"
              >-</button>
              <span className="text-sm font-mono w-14 text-center">{room.settings.turnDurationSeconds}ש'</span>
              <button
                onClick={() => updateSetting({ turnDurationSeconds: Math.min(180, room.settings.turnDurationSeconds + 15) })}
                className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-lg font-bold transition-colors"
              >+</button>
            </div>
          </div>

          {/* Skip penalty — always on per real rules */}
          <div className="flex items-center justify-between opacity-50">
            <div>
              <label className="text-sm text-zinc-300">קנס דילוג</label>
              <p className="text-xs text-zinc-500">מינוס נקודה על כל דילוג (חוק קבוע)</p>
            </div>
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded-lg">תמיד פעיל</span>
          </div>
        </section>
      )}

      {/* Start / waiting */}
      <div className="space-y-2">
        {startError && <p className="text-red-400 text-sm text-center">{startError}</p>}
        {isHost ? (
          <>
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-2xl font-bold text-xl transition-colors"
            >
              {starting ? 'מתחיל…' : 'התחל משחק'}
            </button>
            {!canStart && (
              <p className="text-zinc-500 text-xs text-center">
                צריך לפחות 2 קבוצות עם שחקנים כדי להתחיל
              </p>
            )}
            <button
              onClick={() => socket.emit('room:close')}
              className="w-full py-3 bg-transparent hover:bg-red-950 border border-red-900 rounded-2xl font-bold text-sm text-red-500 transition-colors"
            >
              סגור חדר
            </button>
          </>
        ) : (
          <p className="text-zinc-500 text-sm text-center">ממתין למארח להתחיל…</p>
        )}
      </div>
    </div>
  );
}

// ─── Inline team name editor ───────────────────────────────────────────────────

function TeamNameInput({ value, color, onChange }: {
  value: string;
  color: string;
  onChange: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        maxLength={24}
        className="font-bold bg-zinc-800 rounded-lg px-2 py-0.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 min-w-0 w-32"
        style={{ color }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="font-bold text-right hover:opacity-70 transition-opacity text-sm"
      style={{ color }}
      title="לחץ לשינוי שם"
    >
      {value} <span className="text-zinc-600 text-xs">✎</span>
    </button>
  );
}
