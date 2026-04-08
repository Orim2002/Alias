// ─── How to Play modal ────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function HowToPlayModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 rounded-3xl border border-zinc-700 overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-800">
          <h2 className="text-xl font-black">איך משחקים אֵיילָס</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 text-sm">

          {/* Objective */}
          <Section title="מטרת המשחק">
            <p className="text-zinc-300">
              היו הקבוצה הראשונה להגיע לניקוד היעד על הלוח. מרוויחים נקודות כשחברי הקבוצה
              מנחשים נכון מילים שמישהו מתאר.
            </p>
          </Section>

          {/* Turn flow */}
          <Section title="מהלך התור">
            <ol className="space-y-2 text-zinc-300 list-none">
              <Step n={1}>
                שחקן אחד מהקבוצה הפעילה הופך ל<strong>מתאר</strong>.
              </Step>
              <Step n={2}>
                המתאר רואה מילה ומסביר אותה לחברי קבוצתו במילים חופשיות —
                אבל <em>אסור להגיד את המילה עצמה</em> או חלק ממנה.
              </Step>
              <Step n={3}>
                כל מילה שנוחשה נכון מזיזה את הקבוצה <strong>+1</strong> על הלוח.
              </Step>
              <Step n={4}>
                אפשר לדלג על מילה בכל עת.
                {' '}<span className="text-zinc-500">(קנס דילוג — הגדרה, ברירת מחדל כבוי.)</span>
              </Step>
              <Step n={5}>
                התור מסתיים כשהטיימר נגמר או שכל המילים הסתיימו.
              </Step>
            </ol>
          </Section>

          {/* End-of-turn steal */}
          <Section title="גנבייה בסוף תור" accent="#d97706">
            <div
              className="rounded-2xl p-4 space-y-2"
              style={{ background: '#78350f30', border: '1px solid #d9770650' }}
            >
              <p className="text-amber-300 font-semibold">⚔ גנבו את המילה האחרונה!</p>
              <p className="text-zinc-300">
                כשהטיימר נגמר באמצע תיאור מילה, <strong>קבוצות אחרות</strong> מקבלות
                חלון של 5 שניות לגנוב אותה. לחצו <strong>גנוב!</strong> אם אתם יודעים
                את התשובה — הקבוצה שלכם מקבלת את הנקודה!
              </p>
              <p className="text-zinc-500 text-xs">
                הקבוצה הפעילה לא יכולה לתבוע אותה — הזמן שלהם נגמר.
              </p>
            </div>
          </Section>

          {/* Steal cells */}
          <Section title="תאי גנבייה" accent="#e8a820">
            <div
              className="rounded-2xl p-4 space-y-2"
              style={{ background: '#45260030', border: '1px solid #e8a82050' }}
            >
              <p className="text-amber-300 font-semibold">
                <svg width="14" height="14" style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4 }}>
                  <circle cx="7" cy="7" r="5.5" fill="#f2ece0" stroke="#e8a820" strokeWidth="2" strokeDasharray="2 1.5" />
                </svg>
                תאים מיוחדים על הלוח
              </p>
              <p className="text-zinc-300">
                כשקבוצה נוחתת על <strong>תא גנבייה</strong> (טבעת מנוקדת ענבר), כל התור
                הופך לתור גנבייה. כל קבוצה שיודעת את המילה ראשונה יכולה ללחוץ{' '}
                <strong>גנוב!</strong> ולהרוויח את הנקודה — גם באמצע התור!
              </p>
            </div>
          </Section>

          {/* Board numbers */}
          <Section title="מספרי הלוח (1–8)">
            <p className="text-zinc-300">
              כל תא מציג מספר מ-1 עד 8 במחזוריות. במשחק הפיזי הם מציינים רמת קושי של המילה.
              בגרסה הדיגיטלית הזו כל המילים נשלפות מחפיסה אחת מעורבבת — המספר הוא לעיצוב בלבד.
            </p>
          </Section>

          {/* Winning */}
          <Section title="ניצחון">
            <p className="text-zinc-300">
              הקבוצה הראשונה שניקודה מגיע ל<strong>ניקוד היעד</strong> מנצחת מיד —
              גם אם זה קורה באמצע סיבוב דרך גנבייה.
            </p>
          </Section>

        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-colors"
          >
            הבנתי!
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, accent = '#818cf8', children }: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="shrink-0 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center mt-0.5"
        style={{ background: '#3730a3', color: '#a5b4fc' }}
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
