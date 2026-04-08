import type { RoomView } from '@alias/shared';
import { socket } from '../socket.js';
import { GameBoard } from './GameBoard.js';

interface Props {
  room: RoomView;
  playerId: string;
}

export function TurnReviewScreen({ room, playerId }: Props) {
  const turn = room.currentTurn;
  if (!turn || !turn.words) return null;

  const isHost = room.hostId === playerId;
  const team = room.teams.find(t => t.teamId === turn.teamId);
  const describer = room.players[turn.describerId ?? ''];

  const guessed = turn.words.filter(w => w.status === 'guessed');
  const skipped = turn.words.filter(w => w.status === 'skipped');
  const stolen = turn.words.filter(w => w.status === 'stolen');
  const scoreGain = guessed.length - skipped.length;

  const teamColors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#a855f7', '#06b6d4'];
  const teamIdx = room.teams.findIndex(t => t.teamId === turn.teamId);
  const teamColor = teamColors[teamIdx % teamColors.length]!;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 max-w-lg mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="pt-6 text-center space-y-0.5">
        <h2 className="text-2xl font-black">התור הסתיים</h2>
        <p className="text-sm" style={{ color: teamColor }}>{team?.name}</p>
        <p className="text-zinc-400 text-sm">{describer?.name} תיאר</p>
      </div>

      {/* Score summary */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-2xl font-black text-emerald-400">{guessed.length}</p>
          <p className="text-xs text-zinc-400 mt-0.5">נוחשו</p>
        </div>
        <div>
          <p className="text-2xl font-black text-amber-400">{stolen.length}</p>
          <p className="text-xs text-zinc-400 mt-0.5">נגנבו</p>
        </div>
        <div>
          <p className="text-2xl font-black text-zinc-500">{skipped.length}</p>
          <p className="text-xs text-zinc-400 mt-0.5">דולגו</p>
        </div>
        <div>
          <p className={`text-2xl font-black ${scoreGain > 0 ? 'text-indigo-400' : 'text-zinc-500'}`}>
            {scoreGain > 0 ? `+${scoreGain}` : scoreGain}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">נקודות</p>
        </div>
      </div>

      {/* Board */}
      <section className="space-y-2">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wide">לוח</h3>
        <GameBoard
          teams={room.teams}
          targetScore={room.settings.targetScore}
          activeTeamId={turn.teamId}
        />
      </section>

      {/* Word list */}
      <section className="space-y-2">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wide">מילים בתור זה</h3>
        <div className="space-y-1">
          {turn.words.map((w, i) => {
            const stealingTeam = w.stolenByTeamId
              ? room.teams.find(t => t.teamId === w.stolenByTeamId)
              : null;

            return (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                style={
                  w.status === 'guessed'
                    ? { background: '#052e1650', border: '1px solid #166834' }
                    : w.status === 'stolen'
                      ? { background: '#451a0350', border: '1px solid #92400e' }
                      : { background: '#18181b', border: '1px solid #27272a' }
                }
              >
                <div>
                  <span className="capitalize font-medium text-sm">{w.word}</span>
                  {stealingTeam && (
                    <span className="mr-2 text-[10px] text-amber-500">
                      🗡️ {stealingTeam.name}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold mr-2 shrink-0"
                  style={{
                    color: w.status === 'guessed' ? '#4ade80'
                      : w.status === 'stolen' ? '#fbbf24'
                      : '#52525b',
                  }}
                >
                  {w.status === 'guessed' ? '+1'
                    : w.status === 'stolen' ? '🗡️+1'
                    : '−1'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Continue */}
      <div>
        {isHost ? (
          <button
            onClick={() => socket.emit('turn:confirm_review')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-xl transition-colors"
          >
            תור הבא
          </button>
        ) : (
          <p className="text-zinc-500 text-sm text-center">ממתין למארח להמשיך…</p>
        )}
      </div>
    </div>
  );
}
