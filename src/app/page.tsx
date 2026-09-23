import { EmptyParties } from "@/components/EmptyParties";
import { PartyCard } from "@/components/PartyCard";
import { SearchBox } from "@/components/SearchBox";
import { dayContext } from "@/lib/dates";
import { listParties } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const parties = await listParties(q);
  const days = dayContext();

  return (
    <div>
      <SearchBox initialQuery={q} />

      {parties.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-3">
          {parties.map((party) => (
            <PartyCard key={party.id} party={party} days={days} />
          ))}
        </div>
      ) : q.trim() ? (
        <div className="rounded-[20px] border border-dashed border-line-dash bg-surface px-6 py-11 text-center">
          <p className="mb-2 font-serif text-2xl text-ink">No match</p>
          <p className="text-[15px] text-muted">
            Nothing here matches “{q.trim()}”. Try part of a name or a phone number.
          </p>
        </div>
      ) : (
        <EmptyParties />
      )}
    </div>
  );
}
