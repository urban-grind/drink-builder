import Link from "next/link";
import type { ReactNode } from "react";

function Blank({ children }: { children: ReactNode }) {
  return <strong className="rounded bg-[#274b3a]/10 px-1 font-semibold">{children}</strong>;
}

export function ContestTerms() {
  return (
    <article className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-[#274b3a]/12 bg-[#f3f2ef]/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/urban-grind-logo.png" alt="Urban Grind Coffee Co." className="h-9 w-auto" />
          </Link>
          <Link href="/?faq=1" className="text-sm font-semibold text-[#274b3a]">
            FAQ
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 pt-6 pb-16">
        <p className="text-[11px] font-bold tracking-[0.14em] text-[#274b3a]/70 uppercase">Sip. Snap. Swipe.</p>
        <h1 className="mt-2 font-heading text-4xl leading-none tracking-wide uppercase">Contest terms</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#274b3a]/80">
          Highlighted blanks are still open. They are not part of the finished rules.
        </p>

        <Section title="1. Eligibility and contest dates">
          <p>
            This contest is operated by Urban Grind, doing business as Urban Grind Coffee Co. (“Urban Grind”).
          </p>
          <p>
            The contest is open to Ontario residents aged 18 or older. Urban Grind owners, employees and members of their households are not eligible to win.
          </p>
          <p>
            Entries open on Wednesday, October 7, 2026, at 12:00 a.m. and close on Monday, October 19, 2026, at 12:00 a.m. Voting closes on Friday, October 23, 2026, at 11:59 p.m. All times are Eastern Time.
          </p>
          <p>
            <strong>No purchase is necessary.</strong> You may enter a qualifying photo using your own non-competitor cup or mug and a homemade drink.
          </p>
          <p>
            Limit 20 entries per person.
          </p>
        </Section>

        <Section title="2. What photos can be entered?">
          <p>Your photo must feature a drink in either:</p>
          <ul>
            <li>An Urban Grind branded cup; or</li>
            <li>Non-competitor drinkware, such as a personal mug, glass or reusable cup.</li>
          </ul>
          <p>Photos featuring competing cafés’ or beverage chains’ branded cups, packaging, logos or promotional material are not eligible.</p>
          <p>
            Submit an original photograph you took yourself. Basic cropping, colour correction and lighting adjustments are permitted. Stock images, stolen photographs, AI-generated images and edits that materially misrepresent the photographed drink are not permitted.
          </p>
          <p>
            Photos must not include unlawful, hateful, discriminatory, sexually explicit, threatening or otherwise inappropriate content, or disclose someone else’s private information.
          </p>
        </Section>

        <Section title="3. Ownership and permission from others">
          <p>You confirm that you own the photograph and have the authority to grant the permissions described below.</p>
          <p>
            You must obtain permission from every identifiable person shown in the photo for its public display and commercial use by Urban Grind. If a person shown is under 18, you must obtain permission from their parent or legal guardian.
          </p>
          <p>You must also obtain any necessary permissions for third-party artwork or other protected material featured in your submission.</p>
        </Section>

        <Section title="4. Permission for Urban Grind to use your photo">
          <p>You retain ownership of your photograph.</p>
          <p>
            By submitting it, you grant Urban Grind a <strong>worldwide, perpetual, non-exclusive, royalty-free, transferable and sublicensable licence</strong>, subject to applicable law, to use, reproduce, publish, display, distribute, edit, crop, resize, adapt and combine the photograph with other material for any lawful purpose.
          </p>
          <p>
            This includes use on websites, social media, paid advertisements, printed materials, packaging, signage, in-store displays and other promotional or commercial materials, in any media now existing or developed in the future.
          </p>
          <p>
            <strong>Urban Grind may use your photograph with or without credit, without additional payment, and without seeking further approval.</strong> This permission applies whether or not you win and continues after the contest ends.
          </p>
          <p>
            To the extent permitted by law, you expressly waive your moral rights in the photograph in favour of Urban Grind and anyone it authorizes to use the photograph, including rights relating to attribution and permitted modifications.
          </p>
          <p>Urban Grind is not required to publish or use any submission.</p>
        </Section>

        <Section title="5. Public display and privacy">
          <p>
            Your submitted display name, photograph, drink description, entry date and voting information may appear publicly on the contest website and in contest-related materials.
          </p>
          <p>
            Your phone number or email address will not appear publicly. It will be used to contact you if selected as a potential winner, verify eligibility and arrange the prize.
          </p>
          <p>
            Contest information may be processed by service providers supporting the website and contest. Personal information will be retained only as reasonably necessary for these purposes and legal obligations, as described in <Blank>[link to privacy policy]</Blank>.
          </p>
          <p>Entering does not automatically subscribe you to promotional emails or texts.</p>
        </Section>

        <Section title="6. Voting and fair participation">
          <p>
            Voting is open during the published voting period. There is no limit on how many photos a person may vote for.
          </p>
          <p>
            Sharing your entry and asking friends to vote is encouraged. Bots, automated voting, purchased votes, fake identities, attempts to bypass voting limits and other manipulation are prohibited.
          </p>
          <p>
            Urban Grind may investigate suspicious activity, remove invalid votes and disqualify entrants who manipulate voting or breach these rules. Public vote totals are provisional until verified.
          </p>
        </Section>

        <Section title="7. Prizes and winner selection">
          <p>
            There are 2 prizes available.
          </p>
          <p>
            “Free coffee for a month” means one drink of any size and any type for each day Urban Grind is open in November 2026, redeemable at Urban Grind Coffee Co. in Barrie.
          </p>
          <p>
            The approximate retail value of each prize is $250 CAD. Each prize is non-transferable and has no cash alternative. Unused entitlements expire at the end of November 2026.
          </p>
          <p>
            The winners will be the two eligible entries with the most valid votes. A tie for a winning place is broken by a one-on-one showdown between the tied entries. The showdown lasts 72 hours. The likelihood of winning depends on the number of eligible entries and the valid votes they receive.
          </p>
          <p>
            The potential winners will be contacted by <Blank>[date]</Blank> and must respond within <Blank>[number] days</Blank>, verify eligibility and complete any published prize-claim requirements. If they fail to do so, an alternate will be selected using the same rules.
          </p>
        </Section>

        <Section title="8. Moderation and technical issues">
          <p>Urban Grind may reject or remove submissions that breach these rules, infringe another person’s rights or are unsuitable for public display.</p>
          <p>
            Urban Grind is not responsible for entries or votes lost because of technical failures outside its reasonable control. If fraud, technical problems or other circumstances compromise the contest, Urban Grind may suspend, modify or cancel it where legally permitted. Material changes will be announced publicly and handled fairly.
          </p>
        </Section>

        <Section title="9. General">
          <p>
            This contest is not sponsored, endorsed, administered by or associated with Instagram, Facebook or Meta. To the extent permitted by law, entrants release those platforms from claims arising from this contest.
          </p>
          <p>These rules are governed by Ontario law and applicable Canadian federal law. Nothing in these rules excludes rights that cannot legally be waived.</p>
          <p>
            Questions, privacy requests or concerns about a submission can be sent to{" "}
            <a href="mailto:coffee@urbangrind.ca" className="font-semibold underline underline-offset-2">
              coffee@urbangrind.ca
            </a>
            .
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-2xl leading-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#274b3a]/90 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
    </section>
  );
}
