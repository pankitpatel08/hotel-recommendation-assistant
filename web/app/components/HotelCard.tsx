import type { Hotel } from "../lib/api";

export function formatNightlyPrice(hotel: Hotel): string {
  try {
    const amount = new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: hotel.currency,
      currencyDisplay: "code", // shows the currency explicitly, e.g. "NZD 220"
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(hotel.nightlyPrice);
    return `${amount} per night`;
  } catch {
    return `${hotel.currency} ${hotel.nightlyPrice} per night`; // unknown currency code
  }
}

export function breakfastLabel(hotel: Hotel): string {
  return hotel.breakfastIncluded ? "Breakfast included" : "Breakfast not included";
}

interface HotelCardProps {
  hotel: Hotel;
  selected: boolean;
  onSelect: () => void;
}

export function HotelCard({ hotel, selected, onSelect }: HotelCardProps) {
  const nameId = `hotel-${hotel.id}-name`;
  const buttonId = `hotel-${hotel.id}-select`;

  return (
    <li>
      <article
        aria-labelledby={nameId}
        className={`flex h-full flex-col rounded-xl p-4 shadow-sm sm:p-5 ${
          selected ? "bg-indigo-50 ring-2 ring-indigo-600" : "bg-white ring-1 ring-slate-200"
        }`}
      >
        <h3 id={nameId} className="break-words text-lg font-semibold text-slate-900">
          {hotel.name}
        </h3>
        <p className="mt-2 text-xl font-semibold text-slate-900">{formatNightlyPrice(hotel)}</p>
        <p
          className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${
            hotel.breakfastIncluded
              ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
              : "bg-slate-100 text-slate-800 ring-1 ring-slate-200"
          }`}
        >
          <span aria-hidden="true">{hotel.breakfastIncluded ? "✓" : "✕"}</span>
          {breakfastLabel(hotel)}
        </p>
        <p className="mt-3 flex-1 text-sm text-slate-700">{hotel.explanation}</p>
        <button
          id={buttonId}
          type="button"
          aria-pressed={selected}
          aria-labelledby={`${buttonId} ${nameId}`}
          onClick={onSelect}
          className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
            selected
              ? "border border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800"
              : "border border-indigo-600 bg-white text-indigo-700 hover:bg-indigo-50"
          }`}
        >
          {selected && <span aria-hidden="true">✓ </span>}
          {selected ? "Selected" : "Select"}
        </button>
      </article>
    </li>
  );
}
