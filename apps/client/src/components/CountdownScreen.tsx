import { useState, useEffect } from 'react';
import type { RoomView } from '@alias/shared';

interface Props {
  room: RoomView;
  playerId: string;
}

export function CountdownScreen({ room, playerId }: Props) {
  const turn = room.currentTurn;
  if (!turn) return null;

  const team = room.teams.find(t => t.teamId === turn.teamId);
  const describer = turn.describerId ? room.players[turn.describerId] : null;
  const isDescriber = turn.describerId === playerId;

  const [count, setCount] = useState(3);
  const [endsAt] = useState(turn.endsAt - (room.settings.turnDurationSeconds * 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setCount(remaining > 0 ? remaining : 0);
    }, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  const teamColors = ['indigo', 'rose', 'emerald', 'amber'];
  const teamIdx = room.teams.findIndex(t => t.teamId === turn.teamId);
  const color = teamColors[teamIdx % teamColors.length];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 space-y-8">
      <div className="text-center space-y-2">
        <p className={`text-${color}-400 font-bold uppercase tracking-widest text-sm`}>{team?.name}</p>
        <p className="text-zinc-300 text-lg">
          {isDescriber
            ? 'התכוננו — אתה מתאר!'
            : `${describer?.name ?? 'מישהו'} מתאר`}
        </p>
      </div>

      <div className="relative">
        <div className="text-[10rem] font-black leading-none animate-bounce-in">
          {count || 'קדימה!'}
        </div>
      </div>

      <p className="text-zinc-500 text-sm">
        {room.settings.turnDurationSeconds} שניות · סיבוב {room.round}
      </p>
    </div>
  );
}
