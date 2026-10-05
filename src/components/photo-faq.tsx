import Link from "next/link";

const questions = [
  {
    question: "How do I enter?",
    answer: "Tap + Enter. Add your name, a photo, and a phone number or email. A caption is optional. You can enter up to 20 photos.",
  },
  {
    question: "What photo can I enter?",
    answer: "A drink in an Urban Grind cup, or in your own mug or glass. Don't use another café's branded cup. Use a photo you took yourself.",
  },
  {
    question: "Do I have to buy a drink?",
    answer: "No. A homemade drink in your own cup is fine.",
  },
  {
    question: "When does my photo show up?",
    answer: "We review it first. You can share your link right away. It joins the swipe deck and the leaderboard once it's approved.",
  },
  {
    question: "How do friends vote for me?",
    answer: "Open your photo and share the link. Friends tap it and vote. They don't need an account.",
  },
  {
    question: "How do I vote?",
    answer: "Swipe a photo right, or tap Vote. Swipe left, or tap Skip, to pass.",
  },
  {
    question: "Can I vote for the same photo twice?",
    answer: "Once per photo. You can vote for as many different photos as you like.",
  },
  {
    question: "Can I undo?",
    answer: "Undo brings back the last photo you swiped. A vote on a photo's page is final.",
  },
  {
    question: "Where do I see who's ahead?",
    answer: "Open Leaderboard. Photos are ranked by votes.",
  },
  {
    question: "What can I win?",
    answer: "Two photos win. Each prize is one drink, any size and type, on each day Urban Grind is open in November.",
  },
  {
    question: "When does it end?",
    answer:
      "Entries close Monday, October 19, 2026, at midnight Eastern. Voting closes Friday, October 23, 2026, at 11:59 p.m. Eastern.",
  },
  {
    question: "Who sees my email or phone?",
    answer: "It stays off your photo. We use it to reach you if you win, and so you can find your entries on another phone.",
  },
  {
    question: "How do I find my entries later?",
    answer: "Open My Entries. On another phone, sign in with the same email or phone you used.",
  },
] as const;

export function PhotoFaq() {
  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-col px-5 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:max-w-xl md:pb-28">
      <h1 className="text-center font-heading text-[1.85rem] leading-none tracking-wide uppercase">FAQ.</h1>
      <p className="mt-2 text-center text-sm text-[#274b3a]/75">How the contest works</p>
      <div className="mt-4 divide-y divide-[#274b3a]/12">
        {questions.map((item) => (
          <details key={item.question} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[#274b3a] [&::-webkit-details-marker]:hidden">
              {item.question}
              <Chevron />
            </summary>
            <p className="pt-2 pr-6 text-sm leading-relaxed text-[#274b3a]/80">{item.answer}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/terms" className="font-semibold text-[#274b3a] underline decoration-[#274b3a]/30 underline-offset-4">
          Contest terms
        </Link>
      </p>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[#274b3a]/50 transition-transform group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
