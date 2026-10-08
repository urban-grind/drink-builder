export function CafeLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://urbangrind.ca"
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#274b3a]/15 bg-white py-1 pr-2.5 pl-2 text-[13px] leading-none font-semibold text-[#274b3a] shadow-[0_1px_2px_rgb(39_75_58/8%)] transition-colors hover:border-[#274b3a] hover:bg-[#274b3a] hover:text-[#f7f4ec] ${className}`}
    >
      <TakeoutCup />
      Need a pick me up?
    </a>
  );
}

function TakeoutCup() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path fill="currentColor" d="M9.2 5.5V3.6c0-1.25 1.25-2.2 2.8-2.2s2.8.95 2.8 2.2v1.9z" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2.2 5.1h19.6a1.45 1.45 0 0 1 0 2.9H2.2a1.45 1.45 0 0 1 0-2.9zM10.7 5.7h2.6v1.5h-2.6z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4.3 8.3h15.4l-1.45 12a1.45 1.45 0 0 1-1.43 1.28H7.18a1.45 1.45 0 0 1-1.43-1.28zm.9 3.9h13.5l-.28 2.7H5.48z"
      />
    </svg>
  );
}
