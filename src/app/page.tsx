export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between border-b-2 border-ink py-4">
        <div className="flex items-center gap-2.5 font-display text-[22px] font-black tracking-tight">
          <span className="grid size-7 place-items-center rounded-full bg-orange font-mono text-[13px] font-semibold text-paper-hi">R</span>
          Routewell
        </div>
        <span className="rounded-[3px] border-[1.5px] border-ink px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider">
          PAYPAL SANDBOX
        </span>
      </header>

      <section className="pt-10">
        <h1 className="font-display text-[clamp(52px,9vw,76px)] font-black leading-[0.92] tracking-[-0.035em]">
          Everyone
          <br />
          gets <em className="not-italic text-orange">paid.</em>
        </h1>
        <p className="mt-3 text-base font-medium text-ink-soft">Under construction.</p>
      </section>
    </main>
  );
}
