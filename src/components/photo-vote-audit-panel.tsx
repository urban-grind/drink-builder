import type { VoteAudit } from "@/lib/photo-types";

export function VoteAuditPanel({
  audit,
  pending,
  error,
}: {
  audit: VoteAudit | null;
  pending: boolean;
  error: string | null;
}) {
  if (pending) return <p className="text-sm">Checking votes…</p>;
  if (error) return <p className="text-sm">{error}</p>;
  if (!audit) return null;
  if (audit.voteCount === 0) return <p className="text-sm">No votes yet.</p>;

  return (
    <div className="rounded-xl bg-[#f3f2ef] px-3 py-3 text-sm">
      <p className="font-semibold">
        {audit.voteCount} {audit.voteCount === 1 ? "vote" : "votes"} from {audit.networkCount}{" "}
        {audit.networkCount === 1 ? "network" : "networks"}
      </p>
      {audit.missingNetwork > 0 ? (
        <p className="mt-1">
          {audit.missingNetwork === 1 ? "1 vote has" : `${audit.missingNetwork} votes have`} no network, so the location limit did not apply.
        </p>
      ) : null}
      {audit.fromPhotoPage > 0 ? (
        <p className="mt-1">
          {audit.fromPhotoPage === 1 ? "1 vote came" : `${audit.fromPhotoPage} votes came`} from the photo page.
        </p>
      ) : null}
      {audit.onlyThisPhoto > 0 ? (
        <p className="mt-1">
          {audit.onlyThisPhoto === 1 ? "1 voter only voted" : `${audit.onlyThisPhoto} voters only voted`} for this photo.
        </p>
      ) : null}
      <ul className="mt-3 flex list-none flex-col gap-2">
        {audit.networks.slice(0, 8).map((network) => (
          <li key={network.label}>
            <span className="font-semibold">
              {network.label} · {network.votes} {network.votes === 1 ? "vote" : "votes"}
            </span>
            <span className="mt-0.5 block text-[#274b3a]/70">{network.when}</span>
          </li>
        ))}
      </ul>
      {audit.networks.length > 8 ? (
        <p className="mt-2 text-[#274b3a]/70">
          {audit.networks.length - 8} more {audit.networks.length - 8 === 1 ? "network" : "networks"}
        </p>
      ) : null}
    </div>
  );
}
