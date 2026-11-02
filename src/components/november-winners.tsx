const CONTEST_STATS = [
  { value: "97", label: "Photos submitted" },
  { value: "12,001", label: "Votes" },
] as const;

export function NovemberWinners() {
  return (
    <article className="mx-auto max-w-5xl">
      <h1 className="max-w-xl font-heading text-5xl leading-none text-[#274b3a] sm:text-6xl">Free coffee for a month.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#274b3a]/80">
        Thank you to the hundreds of people who submitted photos and voted. Here are our 3 winners! They each win one drink of any size, each day we are open in November.
      </p>
      <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
        {CONTEST_STATS.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-white px-5 py-4 shadow-[0_16px_40px_rgb(39_75_58/0.08)]">
            <p className="font-heading text-5xl leading-none text-[#274b3a] tabular-nums">{stat.value}</p>
            <p className="mt-2 text-sm font-semibold tracking-[0.12em] text-[#274b3a]/70 uppercase">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-10 overflow-hidden rounded-3xl bg-white shadow-[0_16px_40px_rgb(39_75_58/0.08)]">
        <div className="grid md:grid-cols-[1.2fr_0.8fr]">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/winners/victoria.webp"
              alt="Victoria holding an Urban Grind iced coffee on a road lined with autumn trees"
              className="aspect-[3/4] w-full object-cover md:aspect-auto md:h-full md:min-h-[34rem]"
            />
            <WinnerSeal />
          </div>
          <div className="flex flex-col justify-end px-6 py-8 sm:px-8 sm:py-10">
            <p className="text-sm font-bold tracking-[0.18em] text-[#3d8f5a] uppercase">Most votes</p>
            <h2 className="mt-3 font-heading text-6xl leading-none text-[#274b3a] sm:text-7xl">Victoria</h2>
            <p className="mt-3 text-lg text-[#274b3a]/70">Fall Caffeine</p>
            <p className="mt-4 max-w-xs text-[#274b3a]/80">The photo with the most votes.</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-3xl bg-white shadow-[0_16px_40px_rgb(39_75_58/0.08)]">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/winners/mackenzie.webp"
              alt="A St. Bernard licking an Urban Grind cup held up to a car window"
              className="aspect-[3/4] w-full object-cover"
            />
            <p className="absolute top-4 left-4 rounded-full bg-[#f7f4ec] px-4 py-2.5 text-sm font-bold tracking-[0.14em] text-[#274b3a] uppercase shadow-[0_8px_20px_rgb(0_0_0/0.2)]">
              Urban Grind pick
            </p>
          </div>
          <div className="px-5 py-6 sm:px-6">
            <h2 className="font-heading text-5xl leading-none text-[#274b3a]">Mackenzie</h2>
            <p className="mt-2 text-[#274b3a]/70">UG’s biggest fan</p>
            <p className="mt-3 text-[#274b3a]/80">Picked by the Urban Grind team.</p>
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-3xl bg-[#274b3a] px-6 py-8 text-[#f7f4ec] sm:px-8 sm:py-10">
          <div>
            <p className="inline-flex rounded-full bg-[#f7f4ec] px-4 py-2.5 text-sm font-bold tracking-[0.14em] text-[#274b3a] uppercase">Voting draw</p>
            <h2 className="mt-6 font-heading text-6xl leading-none">Nat</h2>
            <p className="mt-4 max-w-sm text-lg leading-relaxed text-[#f7f4ec]/80">Drawn at random. Every swipe was an entry.</p>
          </div>
        </section>
      </div>
    </article>
  );
}

function WinnerSeal() {
  return (
    <div className="absolute top-4 left-4 flex h-36 w-36 flex-col items-center justify-center rounded-full border-[5px] border-[#f7f4ec] bg-[#274b3a] text-center text-[#f7f4ec] shadow-[0_14px_32px_rgb(0_0_0/0.32)] sm:top-6 sm:left-6 sm:h-44 sm:w-44">
      <span className="text-xs font-bold tracking-[0.22em] uppercase">Winner</span>
      <span className="mt-1 font-heading text-4xl leading-[0.85] sm:text-5xl">
        Most
        <br />
        votes
      </span>
    </div>
  );
}
