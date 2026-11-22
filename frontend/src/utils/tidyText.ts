/*
  Text from the backend sometimes has hyphens and dashes ("March–June", "Log-pile",
  "2126-06-30"). On screen we keep the words calm: ranges read "March to June",
  joined words lose the hyphen and ISO dates become "30 Jun 2126".
*/

const isoDate = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

function formatIso(_: string, year: string, month: string, day: string): string {
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (Number.isNaN(date.getTime())) return `${day} ${month} ${year}`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function tidyText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(isoDate, formatIso)
    .replace(/\bCo-op\b/g, "Coop")
    .replace(/\s+[–—-]\s+/g, ", ")
    .replace(/(\S)[–—](\S)/g, "$1 to $2")
    .replace(/(\d)\s*-\s*(\d)/g, "$1 to $2")
    .replace(/(\p{L})-(\p{L})/gu, "$1 $2");
}
