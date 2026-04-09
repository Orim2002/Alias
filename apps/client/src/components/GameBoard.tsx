import type { Team } from '@alias/shared';
import { getStealPositions } from '@alias/shared';

// ─── Team colors ──────────────────────────────────────────────────────────────
export const TEAM_COLORS: Record<number, { token: string; glow: string; text: string; bg: string; border: string }> = {
  0: { token: '#f87171', glow: '#ef444488', text: '#fca5a5', bg: '#4c0519', border: '#ef4444' }, // אדומה
  1: { token: '#60a5fa', glow: '#3b82f688', text: '#93c5fd', bg: '#1e3a5f', border: '#3b82f6' }, // כחולה
  2: { token: '#4ade80', glow: '#22c55e88', text: '#86efac', bg: '#052e16', border: '#22c55e' }, // ירוקה
  3: { token: '#fbbf24', glow: '#f59e0b88', text: '#fde68a', bg: '#451a03', border: '#f59e0b' }, // צהובה
  4: { token: '#c084fc', glow: '#a855f788', text: '#d8b4fe', bg: '#3b0764', border: '#a855f7' }, // סגולה
  5: { token: '#22d3ee', glow: '#06b6d488', text: '#67e8f9', bg: '#083344', border: '#06b6d4' }, // תכולה
};

// ─── SVG board constants ──────────────────────────────────────────────────────
const R     = 18;          // cell circle radius (SVG units)
const GAP   = 5;           // gap between circle edges
const PITCH = R * 2 + GAP; // center-to-center distance = 41
const PAD   = 14;          // board frame padding

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function buildPath(cols: number, rows: number) {
  const p: { r: number; c: number }[] = [];
  for (let c = 0;        c < cols;     c++) p.push({ r: 0,       c });
  for (let r = 1;        r < rows - 1; r++) p.push({ r,           c: cols - 1 });
  for (let c = cols - 1; c >= 0;       c--) p.push({ r: rows - 1, c });
  for (let r = rows - 2; r >= 1;       r--) p.push({ r,           c: 0 });
  return p;
}

function getBoardDims(targetScore: number) {
  // Target ~2.2 : 1 width-to-height ratio to match the real board
  const rows = Math.max(4, Math.round((targetScore + 4) / 6.4));
  const cols = Math.ceil((targetScore - 2 * (rows - 1)) / 2) + 1;
  return { rows, cols };
}

// SVG coordinate of a cell at grid position (r, c)
function cc(r: number, c: number) {
  return { x: PAD + c * PITCH + R, y: PAD + r * PITCH + R };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  teams: Team[];
  targetScore: number;
  activeTeamId?: string;
}

export function GameBoard({ teams, targetScore, activeTeamId }: Props) {
  const { rows, cols } = getBoardDims(targetScore);
  const path     = buildPath(cols, rows);
  const stealSet = getStealPositions(targetScore);

  // SVG canvas dimensions
  const W = PAD + cols * PITCH - GAP + PAD;
  const H = PAD + rows * PITCH - GAP + PAD;

  // position (1-based) → team indices sitting on it
  const tokensAt = new Map<number, number[]>();
  teams.forEach((team, i) => {
    const pos = Math.min(team.score, targetScore);
    if (pos === 0) return;
    const arr = tokensAt.get(pos) ?? [];
    tokensAt.set(pos, [...arr, i]);
  });

  const waiting = teams.map((t, i) => ({ t, i })).filter(({ t }) => t.score === 0);

  // Center of the hollow interior for the logo
  const logoX = PAD + PITCH + (cols - 2) * PITCH / 2 - GAP / 2;
  const logoY = PAD + PITCH + (rows - 2) * PITCH / 2 - GAP / 2;
  const logoFontSize = Math.max(12, Math.min((cols - 2) * PITCH * 0.13, R * 2.4));

  return (
    <div style={{ fontFamily: '"Inter", system-ui, sans-serif', userSelect: 'none' }}>
      {/* ── SVG board ─────────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))' }}
        aria-label="Game board"
      >
        <defs>
          <linearGradient id="alias-board-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#e8271a" />
            <stop offset="55%"  stopColor="#c81515" />
            <stop offset="100%" stopColor="#a81010" />
          </linearGradient>
          {/* Cell shadow filter */}
          <filter id="alias-cell-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Board background */}
        <rect
          x={1} y={1} width={W - 2} height={H - 2}
          rx={15} ry={15}
          fill="url(#alias-board-bg)"
          stroke="#7a0e0e" strokeWidth={3}
        />

        {/* Inner subtle frame line */}
        <rect
          x={PAD - 2} y={PAD - 2}
          width={W - (PAD - 2) * 2} height={H - (PAD - 2) * 2}
          rx={10} ry={10}
          fill="none"
          stroke="rgba(0,0,0,0.15)" strokeWidth={1}
        />

        {/* ── Cells ─────────────────────────────────────────────────── */}
        {path.map(({ r, c }, idx) => {
          const pos      = idx + 1;
          const { x, y } = cc(r, c);
          const isStart  = pos === 1;
          const isFinish = pos === targetScore;
          const isSteal  = stealSet.has(pos);
          // 1-8 repeating card level — the actual number shown on the real board
          const cellNum  = ((pos - 1) % 8) + 1;
          const tokens   = tokensAt.get(pos) ?? [];

          const cellFill = isStart ? '#1a9e4a' : isFinish ? '#f0c030' : '#f2ece0';
          const numColor = isStart || isFinish ? '#fff' : '#3a2510';

          return (
            <g key={pos}>
              {/* Steal cell — amber ring outside the circle */}
              {isSteal && (
                <circle
                  cx={x} cy={y} r={R + 4}
                  fill="none"
                  stroke="#e8a820" strokeWidth={2.5}
                  strokeDasharray="3 2"
                />
              )}

              {/* Drop shadow */}
              <circle cx={x} cy={y + 1.8} r={R} fill="rgba(0,0,0,0.3)" />

              {/* Cell circle */}
              <circle cx={x} cy={y} r={R} fill={cellFill} />

              {/* Gloss highlight — top-left quadrant */}
              <circle
                cx={x - R * 0.28} cy={y - R * 0.32}
                r={R * 0.42}
                fill="rgba(255,255,255,0.20)"
              />

              {/* Number (only when no pawn is here) */}
              {tokens.length === 0 && (
                <>
                  <text
                    x={x}
                    y={isStart ? y - R * 0.14 : y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={R * (isStart || isFinish ? 0.88 : 0.76)}
                    fontWeight={900}
                    fill={numColor}
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {isStart ? '1' : isFinish ? '★' : String(cellNum)}
                  </text>

                  {/* "התחל" label below the 1 on start */}
                  {isStart && (
                    <text
                      x={x} y={y + R * 0.56}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={R * 0.38} fontWeight={700}
                      fill="rgba(255,255,255,0.85)"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      התחל
                    </text>
                  )}
                </>
              )}

              {/* Pawns */}
              <PawnGroup x={x} y={y} tokens={tokens} />
            </g>
          );
        })}

        {/* ── Center ALiAS logo ───────────────────────────────────────── */}
        {/* Ellipse speech-bubble background */}
        <ellipse
          cx={logoX} cy={logoY}
          rx={(cols - 2) * PITCH * 0.36}
          ry={(rows - 2) * PITCH * 0.38}
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}
        />
        <text
          x={logoX} y={logoY}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={logoFontSize}
          fontWeight={900}
          fontStyle="italic"
          fill="rgba(255,255,255,0.88)"
          fontFamily="Inter, Georgia, serif"
          letterSpacing="-0.5"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
        >
          ALiAS
        </text>
      </svg>

      {/* ── Scoreboard legend ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px 14px',
        alignItems: 'center',
        padding: '6px 2px 0',
      }}>
        {teams.map((team, i) => {
          const c = TEAM_COLORS[i % 6]!;
          const isActive = team.teamId === activeTeamId;
          return (
            <div key={team.teamId} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              opacity: isActive ? 1 : 0.6,
            }}>
              <svg width="10" height="10" style={{ flexShrink: 0 }}>
                <circle cx="5" cy="5" r="4.5" fill={c.token} />
              </svg>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: isActive ? 700 : 400 }}>
                {team.name}
              </span>
              <span style={{ color: c.token, fontSize: 12, fontWeight: 800 }}>
                {team.score}
              </span>
            </div>
          );
        })}
        {/* Steal key */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14">
            <circle cx="7" cy="7" r="5.5" fill="#f2ece0" stroke="#e8a820" strokeWidth="2" strokeDasharray="2 1.5" />
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>תא גנבייה</span>
        </div>
      </div>

      {/* Waiting at start */}
      {waiting.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          padding: '4px 2px 0',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          marginTop: 4,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>ממתינים:</span>
          {waiting.map(({ i }) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10">
                <circle cx="5" cy="5" r="4.5" fill={TEAM_COLORS[i % 6]!.token} />
              </svg>
              <span style={{ color: TEAM_COLORS[i % 6]!.text, fontSize: 11 }}>
                {teams[i]?.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pawn group ───────────────────────────────────────────────────────────────

function PawnGroup({ x, y, tokens }: { x: number; y: number; tokens: number[] }) {
  if (tokens.length === 0) return null;

  const placements: { dx: number; dy: number; r: number }[] =
    tokens.length === 1
      ? [{ dx: 0, dy: 0, r: R * 0.60 }]
      : tokens.length === 2
        ? [{ dx: -R * 0.34, dy: 0, r: R * 0.42 }, { dx: R * 0.34, dy: 0, r: R * 0.42 }]
        : [
            { dx: -R * 0.33, dy: -R * 0.33, r: R * 0.36 },
            { dx:  R * 0.33, dy: -R * 0.33, r: R * 0.36 },
            { dx: -R * 0.33, dy:  R * 0.33, r: R * 0.36 },
            { dx:  R * 0.33, dy:  R * 0.33, r: R * 0.36 },
          ];

  return (
    <>
      {tokens.slice(0, 4).map((teamIdx, i) => {
        const pl = placements[i];
        if (!pl) return null;
        const c = TEAM_COLORS[teamIdx % 6]!;
        const px = x + pl.dx;
        const py = y + pl.dy;
        const pr = pl.r;
        return (
          <g key={i}>
            {/* Shadow */}
            <circle cx={px} cy={py + 1.5} r={pr} fill="rgba(0,0,0,0.45)" />
            {/* Pawn body */}
            <circle cx={px} cy={py} r={pr} fill={c.token} />
            {/* Shine */}
            <circle cx={px - pr * 0.3} cy={py - pr * 0.32} r={pr * 0.38} fill="rgba(255,255,255,0.28)" />
          </g>
        );
      })}
    </>
  );
}
