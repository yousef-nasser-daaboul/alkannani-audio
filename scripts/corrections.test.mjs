// corrections.json is hand-edited, so check it before it ships under a tag.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Keys of CalculationMethod and values of Madhab in the `adhan` library the app uses.
const CalculationMethods = [
  "MuslimWorldLeague", "Egyptian", "Karachi", "UmmAlQura", "Dubai", "MoonsightingCommittee",
  "NorthAmerica", "Kuwait", "Qatar", "Singapore", "Tehran", "Turkey", "Other",
];
const Madhabs = ["shafi", "hanafi"];
const PrayerOffsetKeys = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

const corrections = JSON.parse(
  await readFile(new URL("../corrections.json", import.meta.url), "utf8"),
);

/** Checks the optional method / madhab / offsetsMinutes of a country or city entry. */
function assertEntry(where, entry) {
  if ("method" in entry) {
    assert.ok(CalculationMethods.includes(entry.method), `${where}: unknown method ${entry.method}`);
  }
  if ("madhab" in entry) {
    assert.ok(Madhabs.includes(entry.madhab), `${where}: unknown madhab ${entry.madhab}`);
  }
  for (const [prayer, minutes] of Object.entries(entry.offsetsMinutes ?? {})) {
    assert.ok(PrayerOffsetKeys.includes(prayer), `${where}: unknown prayer ${prayer}`);
    assert.ok(Number.isInteger(minutes), `${where}.${prayer}: minutes must be an integer`);
  }
}

test("corrections.json has schemaVersion 1 and only known fields", () => {
  assert.equal(corrections.schemaVersion, 1);
  for (const [country, entry] of Object.entries(corrections.countries)) {
    assert.match(country, /^[A-Z]{2}$/, `${country}: country keys are ISO 3166-1 alpha-2`);
    assertEntry(country, entry);
    for (const [city, cityEntry] of Object.entries(entry.cities ?? {})) {
      assertEntry(`${country}/${city}`, cityEntry);
    }
  }
});

test("Syria matches the Awqaf «مسجدك» app: MWL, Shafi, Asr +2, Maghrib +2", () => {
  const { method, madhab, offsetsMinutes } = corrections.countries.SY;
  assert.deepEqual({ method, madhab, offsetsMinutes }, {
    method: "MuslimWorldLeague",
    madhab: "shafi",
    offsetsMinutes: { asr: 2, maghrib: 2 },
  });
});
