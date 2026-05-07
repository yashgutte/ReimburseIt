export const neon = {
  page: "min-h-[calc(100vh-3.5rem)] bg-black text-white",
  shell: "mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8",
  grid12: "grid grid-cols-12 gap-4 lg:gap-6",
  card: [
    "rounded-xl border border-white/10 bg-neutral-950/60 text-gray-100",
    "backdrop-blur-sm transition-all duration-200",
    "hover:border-cyan-500/20 hover:shadow-glow-cyan-soft hover:scale-[1.02]",
  ].join(" "),
  cardStatic: [
    "rounded-xl border border-white/10 bg-neutral-950/60 text-gray-100",
    "backdrop-blur-sm transition-all duration-200",
  ].join(" "),
  heading: "text-xl font-bold tracking-tight text-white md:text-2xl",
  sub: "text-sm text-gray-400",
  accent: "text-cyan-400",
  border: "border-white/10",
  borderAccent: "border-cyan-500/20",
  input:
    "border-white/10 bg-black/40 text-white placeholder:text-gray-500 focus-visible:border-cyan-500/40 focus-visible:ring-cyan-400/30",
  btnPrimary:
    "bg-cyan-500 text-black hover:bg-cyan-400 shadow-glow-cyan-soft hover:shadow-glow-cyan transition-all duration-200 hover:scale-[1.02]",
};
