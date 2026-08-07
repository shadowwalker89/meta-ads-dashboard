const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EMPTY_TOKENS = new Set(["", "-", "—", "–", "n/a"]);

function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    let index = PERSIAN_DIGITS.indexOf(ch);
    if (index === -1) index = ARABIC_INDIC_DIGITS.indexOf(ch);
    return index === -1 ? ch : String(index);
  });
}

/**
 * Parses a raw, human-formatted number string (as scraped from a UI)
 * into a JS number, or `null` if it represents "no value". Handles:
 *  - Persian/Arabic-Indic digits (۰-۹ / ٠-٩) → ASCII digits
 *  - thousands separators: "," and "٬"
 *  - decimal separators: "." and "٫"
 *  - currency symbols and "%" / "٪" (stripped — not part of the number)
 *  - empty/unavailable markers ("", "-", "—", "–", "N/A") → null
 *
 * Disambiguates "," vs "." when either could be the decimal separator
 * (e.g. "€45,00" vs "$1,234.56") the way a human would: if both
 * separator characters appear, the rightmost one is the decimal
 * separator; if only one appears and it's followed by 1-2 digits, it
 * reads as a decimal separator too — otherwise every occurrence is
 * treated as a thousands separator.
 */
export function parseLocalizedNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  const normalizedDigits = normalizeDigits(raw.trim());

  if (EMPTY_TOKENS.has(normalizedDigits.toLowerCase())) {
    return null;
  }

  // Strip anything that isn't a digit, a known separator, or a minus
  // sign — currency symbols, %, ٪, whitespace, etc. all fall away.
  let cleaned = normalizedDigits.replace(/[^0-9.,٫٬-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;

  const isNegative = cleaned.startsWith("-");
  if (isNegative) cleaned = cleaned.slice(1);

  // Unify Persian separators to their Latin equivalents.
  cleaned = cleaned.replace(/٬/g, ",").replace(/٫/g, ".");

  const separatorMatches = [...cleaned.matchAll(/[.,]/g)];
  let decimalSeparatorIndex = -1;

  if (separatorMatches.length > 0) {
    const last = separatorMatches[separatorMatches.length - 1];
    const distinctSeparators = new Set(separatorMatches.map((m) => m[0]));
    const trailingDigitCount = cleaned.length - (last.index! + 1);

    if (distinctSeparators.size > 1) {
      // Mixed "," and "." in the same string — rightmost is decimal.
      decimalSeparatorIndex = last.index!;
    } else if (separatorMatches.length === 1 && trailingDigitCount <= 2) {
      // A single separator followed by 1-2 digits reads as a decimal
      // (e.g. "45,00" or "45.5"), not a thousands group.
      decimalSeparatorIndex = last.index!;
    }
    // Otherwise every occurrence is a thousands separator, stripped below.
  }

  let integerPart: string;
  let fractionPart = "";

  if (decimalSeparatorIndex >= 0) {
    integerPart = cleaned.slice(0, decimalSeparatorIndex).replace(/[.,]/g, "");
    fractionPart = cleaned.slice(decimalSeparatorIndex + 1).replace(/[.,]/g, "");
  } else {
    integerPart = cleaned.replace(/[.,]/g, "");
  }

  if (integerPart === "" && fractionPart === "") return null;

  const numericString = `${integerPart || "0"}${fractionPart ? "." + fractionPart : ""}`;
  const value = Number(numericString);

  if (Number.isNaN(value)) return null;

  return isNegative ? -value : value;
}
