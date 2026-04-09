import { useState } from 'react';
import type { AckResponse } from '@alias/shared';
import { socket } from '../socket.js';
import { saveSession } from '../store.js';

interface Props {
  onJoined: (playerId: string) => void;
}

export function HomeScreen({ onJoined }: Props) {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function connect() {
    if (!socket.connected) socket.connect();
  }

  async function handleCreate() {
    if (!name.trim()) return setError('הכנס את שמך תחילה.');
    setError('');
    setLoading(true);
    connect();

    socket.emit('room:create', { playerName: name.trim() }, (res: AckResponse<{ roomCode: string; playerId: string }>) => {
      setLoading(false);
      if (!res.ok) return setError(res.error);
      saveSession(res.data.playerId, res.data.roomCode);
      onJoined(res.data.playerId);
    });
  }

  async function handleJoin() {
    if (!name.trim()) return setError('הכנס את שמך תחילה.');
    if (!code.trim()) return setError('הכנס קוד חדר.');
    setError('');
    setLoading(true);
    connect();

    socket.emit('room:join', { roomCode: code.trim().toUpperCase(), playerName: name.trim() }, (res: AckResponse<{ playerId: string }>) => {
      setLoading(false);
      if (!res.ok) return setError(res.error);
      saveSession(res.data.playerId, code.trim().toUpperCase());
      onJoined(res.data.playerId);
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-white">alias</h1>
          <p className="text-zinc-400 text-sm">משחק המסיבה לניחוש מילים</p>
        </div>

        {mode === 'home' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-lg transition-colors"
            >
              צור חדר
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-bold text-lg transition-colors"
            >
              הצטרף לחדר
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode('home'); setError(''); }}
              className="text-zinc-400 hover:text-white text-sm transition-colors"
            >
              חזור
            </button>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 uppercase tracking-wide">שמך</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
                  maxLength={24}
                  placeholder="לדוגמה: יוסי"
                  className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
                  autoFocus
                />
              </div>

              {mode === 'join' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 uppercase tracking-wide">קוד חדר</label>
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    maxLength={10}
                    placeholder="לדוגמה: WOLF-42"
                    className="w-full px-4 py-3 bg-zinc-800 rounded-xl text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-mono tracking-widest"
                  />
                </div>
              )}

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-2xl font-bold text-lg transition-colors"
              >
                {loading ? 'מתחבר…' : mode === 'create' ? 'צור חדר' : 'הצטרף לחדר'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
