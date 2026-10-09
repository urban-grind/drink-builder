import { parseContestClick } from "@/lib/contest-report";
import { easternDayRange } from "@/lib/eastern-day";

const PATH_LIMIT = 20;

export type UsageEvent = {
  visitorId: string;
  kind: string;
  name: string;
  at: string;
  personName: string | null;
};

export type UsageFunnel = {
  popular: number;
  openedDrink: number;
  ordered: number;
};

export type UsageDrink = {
  name: string;
  opens: number;
  orders: number;
};

export type UsagePlace = {
  people: number;
  visits: number;
};

export type UsageCount = {
  label: string;
  count: number;
};

export type UsagePath = {
  personName: string | null;
  at: string;
  trail: string[];
  also: UsageCount[];
  ordered: boolean;
};

export type UsageSlice = {
  funnel: UsageFunnel;
  drinks: UsageDrink[];
  ranges: { today: number; week: number; month: number };
  places: { vote: UsagePlace; leaderboard: UsagePlace; photo: UsagePlace };
  shares: { link: number; story: number; post: number };
  paths: UsagePath[];
};

export type SiteUsage = {
  today: UsageSlice;
  all: UsageSlice;
};

export function usageStep(kind: string, name: string): string | null {
  if (kind === "visit") {
    if (name === "vote") return "Vote";
    if (name === "leaderboard") return "Leaderboard";
    if (name === "photo") return "Photo";
    if (name === "popular") return "Popular";
    return null;
  }
  const parsed = parseContestClick(name);
  if (!parsed) return null;
  if (parsed.id === "share-link") return "Shared a link";
  if (parsed.id === "download-story") return "Downloaded a story";
  if (parsed.id === "download-post") return "Downloaded a post";
  if (parsed.id === "popular-today") return "Popular today";
  if (parsed.id === "popular-week") return "Popular this week";
  if (parsed.id === "popular-month") return "Popular this month";
  if (parsed.id === "popular-drink" && parsed.drink) return `Opened ${parsed.drink}`;
  if (parsed.id === "popular-order" && parsed.drink) return `Ordered ${parsed.drink}`;
  return null;
}

export function orderPathSummary(funnel: UsageFunnel): string {
  if (funnel.popular === 0) return "No one has opened Popular.";
  if (funnel.openedDrink === 0) {
    return funnel.popular === 1
      ? "1 person opened Popular and left without opening a drink."
      : `${funnel.popular} people opened Popular and left without opening a drink.`;
  }
  if (funnel.ordered === 0) {
    const stopped =
      funnel.openedDrink === 1
        ? "1 person opened a drink and stopped there."
        : `${funnel.openedDrink} people opened a drink and stopped there.`;
    return `${stopped}${leftWithoutDrink(funnel)}`;
  }
  const ordered = funnel.ordered === 1 ? "1 person left to order." : `${funnel.ordered} people left to order.`;
  const stopped = funnel.openedDrink - funnel.ordered;
  const leftMenu = leftWithoutDrink(funnel);
  if (stopped <= 0) return `${ordered} Everyone who opened a drink went on to order.${leftMenu}`;
  const rest = stopped === 1 ? "1 person opened a drink and stopped there." : `${stopped} people opened a drink and stopped there.`;
  return `${ordered} ${rest}${leftMenu}`;
}

function leftWithoutDrink(funnel: UsageFunnel): string {
  const skipped = funnel.popular - funnel.openedDrink;
  if (skipped <= 0) return "";
  return skipped === 1
    ? " 1 person opened Popular and left without a drink."
    : ` ${skipped} people opened Popular and left without a drink.`;
}

export function buildSiteUsage(events: readonly UsageEvent[], now = new Date()): SiteUsage {
  const start = easternDayRange(now).start;
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return {
    today: sliceUsage(ordered.filter((event) => event.at >= start)),
    all: sliceUsage(ordered),
  };
}

function recordStep(step: string, trail: string[], other: Map<string, number>, otherOrder: string[]) {
  const onMenu = step === "Popular" || step.startsWith("Popular ") || step.startsWith("Opened ") || step.startsWith("Ordered ");
  if (onMenu) {
    if (trail.at(-1) !== step) trail.push(step);
    return;
  }
  if (!other.has(step)) otherOrder.push(step);
  other.set(step, (other.get(step) ?? 0) + 1);
}

function sliceUsage(events: readonly UsageEvent[]): UsageSlice {
  const byVisitor = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const list = byVisitor.get(event.visitorId) ?? [];
    list.push(event);
    byVisitor.set(event.visitorId, list);
  }

  const funnel = { popular: 0, openedDrink: 0, ordered: 0 };
  const opens = new Map<string, number>();
  const orders = new Map<string, number>();
  const ranges = { today: 0, week: 0, month: 0 };
  const visits = { vote: 0, leaderboard: 0, photo: 0 };
  const visitors = { vote: new Set<string>(), leaderboard: new Set<string>(), photo: new Set<string>() };
  const shares = { link: 0, story: 0, post: 0 };
  const paths: UsagePath[] = [];

  for (const [visitorId, list] of byVisitor) {
    let sawPopular = false;
    let sawDrink = false;
    let sawOrder = false;
    let personName: string | null = null;
    const trail: string[] = [];
    const other = new Map<string, number>();
    const otherOrder: string[] = [];
    for (const event of list) {
      const name = event.personName?.trim();
      if (name) personName = name;
      const step = usageStep(event.kind, event.name);
      if (step) recordStep(step, trail, other, otherOrder);
      if (event.kind === "visit" && event.name === "popular") sawPopular = true;
      if (event.kind === "visit" && (event.name === "vote" || event.name === "leaderboard" || event.name === "photo")) {
        visits[event.name] += 1;
        visitors[event.name].add(visitorId);
      }
      const click = event.kind === "click" ? parseContestClick(event.name) : null;
      if (!click) continue;
      if (click.id === "popular-drink" && click.drink) {
        opens.set(click.drink, (opens.get(click.drink) ?? 0) + 1);
        if (sawPopular) sawDrink = true;
      }
      if (click.id === "popular-order" && click.drink) {
        orders.set(click.drink, (orders.get(click.drink) ?? 0) + 1);
        if (sawDrink) sawOrder = true;
      }
      if (click.id === "popular-today") ranges.today += 1;
      if (click.id === "popular-week") ranges.week += 1;
      if (click.id === "popular-month") ranges.month += 1;
      if (click.id === "share-link") shares.link += 1;
      if (click.id === "download-story") shares.story += 1;
      if (click.id === "download-post") shares.post += 1;
    }
    if (sawPopular) funnel.popular += 1;
    if (sawDrink) funnel.openedDrink += 1;
    if (sawOrder) funnel.ordered += 1;
    if (trail.length > 0 || otherOrder.length > 0) {
      paths.push({
        personName,
        at: list[list.length - 1]?.at ?? "",
        trail,
        also: otherOrder.map((label) => ({ label, count: other.get(label) ?? 0 })),
        ordered: sawOrder,
      });
    }
  }

  const names = new Set([...opens.keys(), ...orders.keys()]);
  const drinks = [...names]
    .map((name) => ({ name, opens: opens.get(name) ?? 0, orders: orders.get(name) ?? 0 }))
    .sort((a, b) => b.orders - a.orders || b.opens - a.opens || a.name.localeCompare(b.name));
  paths.sort((a, b) => b.at.localeCompare(a.at));

  return {
    funnel,
    drinks,
    ranges,
    places: {
      vote: { people: visitors.vote.size, visits: visits.vote },
      leaderboard: { people: visitors.leaderboard.size, visits: visits.leaderboard },
      photo: { people: visitors.photo.size, visits: visits.photo },
    },
    shares,
    paths: paths.slice(0, PATH_LIMIT),
  };
}
