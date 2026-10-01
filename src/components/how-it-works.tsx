const steps = [
  {
    number: "01",
    title: "Snap your drink",
    body: "The one in your hand, from the counter.",
    active: true,
  },
  {
    number: "02",
    title: "Put it up",
    body: "Your name and the drink. One photo per email or phone.",
    active: false,
  },
  {
    number: "03",
    title: "Barrie votes",
    body: "The ones people love move up.",
    active: false,
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
      <div>
        <h2 id="how-it-works" className="text-4xl sm:text-5xl">
          How it works
        </h2>
        <p className="mt-3 max-w-2xl text-pretty">Three steps.</p>
      </div>
      <ol className="grid list-none grid-cols-1 gap-4 lg:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.number}
            className={
              step.active
                ? "flex min-h-52 flex-col justify-between rounded-2xl bg-[#274b3a] px-6 py-7 text-[#f3f2ef]"
                : "flex min-h-52 flex-col justify-between rounded-2xl bg-white px-6 py-7 text-[#274b3a] shadow-[0_16px_40px_rgb(39_75_58/0.06)]"
            }
          >
            <p className="font-heading text-4xl leading-none">{step.number}</p>
            <div className="mt-10">
              <h3 className="text-2xl text-balance">{step.title}</h3>
              <p className={`mt-2 text-pretty ${step.active ? "text-[#f3f2ef]/85" : "text-[#3f5d4e]"}`}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
