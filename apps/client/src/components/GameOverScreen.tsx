import type { RoomView } from '@alias/shared';
import { GameBoard, TEAM_COLORS } from './GameBoard.js';
import { clearSession } from '../store.js';

interface Props {
  room: RoomView;
  playerId: string;
}

export function GameOverScreen({ room, playerId }: Props) {
  const sorted = [...room.teams].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const isTie = sorted.length > 1 && sorted[1]?.score === topScore;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 max-w-lg mx-auto space-y-6 pb-10">
      {/* Trophy header */}
      <div className="pt-8 text-center space-y-2">
        <div className="text-6xl">{isTie ? '🤝' : '🏆'}</div>
        <h1 className="text-3xl font-black">
          {isTie ? 'תיקו!' : `${sorted[0]?.name} מנצחת!`}
        </h1>
        <p className="text-zinc-400 text-sm">
          היעד היה {room.settings.targetScore} נקודות
        </p>
      </div>

      {/* Final board state */}
      <section className="space-y-2">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wide">לוח סופי</h3>
        <GameBoard teams={room.teams} targetScore={room.settings.targetScore} />
      </section>

      {/* Final scoreboard */}
      <section className="space-y-2">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wide">ניקוד סופי</h3>
        <div className="space-y-2">
          {sorted.map((team, rank) => {
            const origIdx = room.teams.indexOf(team);
            const c = TEAM_COLORS[origIdx % 6]!;
            const isWinner = rank === 0 && !isTie;

            return (
              <div
                key={team.teamId}
                className="flex items-center justify-between px-5 py-3.5 rounded-2xl border"
                style={isWinner
                  ? { backgroundColor: `${c.bg}`, borderColor: c.border }
                  : { backgroundColor: '#18181b', borderColor: '#27272a' }
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 font-bold text-sm">{rank + 1}.</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.token }} />
                  <span className="font-bold" style={{ color: c.text }}>{team.name}</span>
                  {isWinner && <span className="text-base">👑</span>}
                </div>
                <span className="text-2xl font-black tabular-nums">{team.score}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Players */}
      <section className="space-y-2">
        <h3 className="text-xs text-zinc-500 uppercase tracking-wide">שחקנים</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(room.players).map(p => (
            <span key={p.playerId} className="text-sm text-zinc-300 bg-zinc-800 px-3 py-1.5 rounded-full">
              {p.name}{p.playerId === playerId ? ' (אתה)' : ''}
            </span>
          ))}
        </div>
      </section>

      <button
        onClick={() => { clearSession(); window.location.reload(); }}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-xl transition-colors"
      >
        שחקו שוב
      </button>
    </div>
  );
}
