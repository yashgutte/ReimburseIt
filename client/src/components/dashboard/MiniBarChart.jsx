const defaultSeries = [40, 65, 45, 80, 55, 90, 70];

export default function MiniBarChart({ series = defaultSeries, className = "" }) {
  const max = Math.max(...series, 1);
  return (
    <div
      className={`flex h-28 items-end justify-between gap-1.5 px-1 ${className}`}
      role="img"
      aria-label="Activity chart"
    >
      {series.map((v, i) => (
        <div key={i} className="flex h-full min-h-0 flex-1 flex-col justify-end">
          <div
            className="w-full min-h-[6px] rounded-t-sm bg-gradient-to-t from-cyan-500/25 to-cyan-400/70 transition-all duration-200 hover:from-cyan-400/45 hover:to-cyan-300/90"
            style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  );
}
