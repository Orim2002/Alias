import { useGameState } from './store.js';
import { HomeScreen } from './components/HomeScreen.js';
import { LobbyScreen } from './components/LobbyScreen.js';
import { CountdownScreen } from './components/CountdownScreen.js';
import { TurnActiveScreen } from './components/TurnActiveScreen.js';
import { TurnReviewScreen } from './components/TurnReviewScreen.js';
import { GameOverScreen } from './components/GameOverScreen.js';

export function App() {
  const { state, setPlayerId } = useGameState();
  const { room, playerId, currentWord, lastWordResult, connected } = state;

  // ── No room yet — show home ───────────────────────────────────────────────
  if (!room || !playerId) {
    return <HomeScreen onJoined={setPlayerId} />;
  }

  // ── Route by room status ──────────────────────────────────────────────────
  switch (room.status) {
    case 'lobby':
      return <LobbyScreen room={room} playerId={playerId} />;

    case 'turn_countdown':
      return <CountdownScreen room={room} playerId={playerId} />;

    case 'turn_active':
      return (
        <TurnActiveScreen
          room={room}
          playerId={playerId}
          currentWord={currentWord}
          lastWordResult={lastWordResult}
        />
      );

    case 'turn_review':
      return <TurnReviewScreen room={room} playerId={playerId} />;

    case 'game_over':
      return <GameOverScreen room={room} playerId={playerId} />;

    default:
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <p className="text-zinc-400">Loading…</p>
        </div>
      );
  }
}
