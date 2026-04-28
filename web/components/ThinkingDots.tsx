export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3" aria-label="Agent is thinking">
      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
    </div>
  );
}
