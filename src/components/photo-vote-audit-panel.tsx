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
      <div className="mt-3 max-h-80 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-[#f3f2ef]">
            <tr className="text-[#274b3a]/70">
              <th className="py-1 pr-3 font-semibold">Time</th>
              <th className="py-1 pr-3 font-semibold">Browser id</th>
              <th className="py-1 font-semibold">Page</th>
            </tr>
          </thead>
          <tbody>
            {audit.votes.map((vote) => (
              <tr key={vote.browserId} className="border-t border-[#274b3a]/12 align-top">
                <td className="py-1.5 pr-3 whitespace-nowrap">{vote.at}</td>
                <td className="py-1.5 pr-3 font-mono text-xs break-all">{vote.browserId}</td>
                <td className="py-1.5 whitespace-nowrap">{vote.page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
