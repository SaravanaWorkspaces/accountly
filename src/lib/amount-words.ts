/**
 * Money spelled out, the way it is written on a cheque.
 *
 * Which scale to use comes from the locale rather than being assumed: the
 * Indian and international systems agree up to 99,999 and part company at a
 * lakh, so a deployment running `en-US` would be told "one lakh" for a number
 * its readers call "one hundred thousand".
 */
import { CURRENCY, LOCALE } from "./money";

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];

const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

/** `₹` has its own minor unit; the rest of these are close enough to universal. */
const CURRENCY_NAMES: Record<string, { major: [string, string]; minor: [string, string] }> = {
  "₹": { major: ["rupee", "rupees"], minor: ["paisa", "paise"] },
  $: { major: ["dollar", "dollars"], minor: ["cent", "cents"] },
  "€": { major: ["euro", "euros"], minor: ["cent", "cents"] },
  "£": { major: ["pound", "pounds"], minor: ["penny", "pence"] },
};

/**
 * Indian: the last three digits, then two at a time — thousand, lakh, crore.
 * International: three at a time — thousand, million, billion, trillion.
 */
function scaleFor(locale: string) {
  const indian = /-(IN|LK|BD|NP|PK)\b/i.test(locale);
  return indian
    ? { chunk: 2, names: ["thousand", "lakh", "crore"] }
    : { chunk: 3, names: ["thousand", "million", "billion", "trillion"] };
}

/** 0–999 in words. */
function underThousand(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ten = TENS[Math.floor(n / 10)];
    const one = n % 10;
    return one ? `${ten}-${ONES[one]}` : ten;
  }
  const rest = n % 100;
  const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
  return rest ? `${hundreds} ${underThousand(rest)}` : hundreds;
}

/** A whole number in words, with no currency attached. */
export function numberToWords(value: number, locale: string = LOCALE): string {
  const n = Math.floor(Math.abs(value));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return ONES[0];

  const { chunk, names } = scaleFor(locale);
  const groupSize = 10 ** chunk;

  // The lowest three digits stand on their own in both systems.
  const parts: string[] = [];
  let rest = Math.floor(n / 1000);
  const lastThree = n % 1000;

  for (let i = 0; rest > 0 && i < names.length; i += 1) {
    // The largest unit takes everything still left, rather than a slice of it:
    // there is no name above crore, so 12,00,00,00,000 is "one thousand two
    // hundred crore" and not "twelve crore".
    const last = i === names.length - 1;
    const group = last ? rest : rest % groupSize;

    if (group > 0) {
      const words = group < 1000 ? underThousand(group) : numberToWords(group, locale);
      parts.unshift(`${words} ${names[i]}`);
    }

    rest = last ? 0 : Math.floor(rest / groupSize);
  }

  if (lastThree > 0) parts.push(underThousand(lastThree));
  return parts.join(" ");
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Minor units spelled out with the currency, e.g. 1250075 →
 * "Twelve thousand five hundred rupees and seventy-five paise".
 *
 * An unfamiliar currency symbol drops the noun rather than guessing at one.
 */
export function amountInWords(minor: number, locale: string = LOCALE): string {
  if (!Number.isFinite(minor)) return "";

  const total = Math.abs(Math.round(minor));
  const major = Math.floor(total / 100);
  const fraction = total % 100;
  const names = CURRENCY_NAMES[CURRENCY];

  const majorWords = numberToWords(major, locale);
  const head = names
    ? `${majorWords} ${major === 1 ? names.major[0] : names.major[1]}`
    : majorWords;

  if (fraction === 0) return capitalise(head);

  const fractionWords = underThousand(fraction);
  const tail = names
    ? `${fractionWords} ${fraction === 1 ? names.minor[0] : names.minor[1]}`
    : fractionWords;

  return capitalise(`${head} and ${tail}`);
}

/**
 * Past three digits a figure stops being readable at a glance — ₹125000 and
 * ₹12500 look alike in a hurry — which is where the words earn their place.
 */
export const SPELL_OUT_FROM = 1000;

/** The words for an amount, or null while it is short enough to read as digits. */
export function amountWordsFor(minor: number | null): string | null {
  if (minor === null || !Number.isFinite(minor)) return null;
  if (Math.floor(Math.abs(minor) / 100) < SPELL_OUT_FROM) return null;
  return amountInWords(minor);
}
