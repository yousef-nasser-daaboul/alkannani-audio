import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManifest } from "./manifest.mjs";

const BILAL = "الأستاذ بلال عبد العزيز";
const catalog = {
  muezzins: { "bilal-abdulaziz": { name: BILAL } },
  maqamat: { jiharkah: { name: "جهركاه" } },
  reminders: { "bilal-abdulaziz/tazkeer": { prayer: "isha" } },
};

/** Compares as JSON text so key order is part of the assertion. */
function assertSameJson(actual, expected) {
  assert.equal(JSON.stringify(actual, null, 2), JSON.stringify(expected, null, 2));
}

test("a fajr adhan without a maqam becomes an adhan entry with maqam null", () => {
  const manifest = buildManifest({
    version: "v1.0.0",
    catalog,
    files: [{ path: "audio/adhan/bilal-abdulaziz/fajr.mp3", sizeBytes: 1825522, durationMs: 284526 }],
  });

  assertSameJson(manifest, {
    schemaVersion: 1,
    version: "v1.0.0",
    adhans: [
      {
        id: "adhan/bilal-abdulaziz/fajr",
        kind: "fajr",
        muezzin: { id: "bilal-abdulaziz", name: BILAL },
        maqam: null,
        displayName: BILAL,
        url: "https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/audio/adhan/bilal-abdulaziz/fajr.mp3",
        sizeBytes: 1825522,
        durationMs: 284526,
      },
    ],
    reminders: [],
  });
});

test("a maqam suffix on a regular adhan resolves to the catalog maqam", () => {
  const manifest = buildManifest({
    version: "v1.0.0",
    catalog,
    files: [{ path: "audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3", sizeBytes: 1989715, durationMs: 313757 }],
  });

  assertSameJson(manifest.adhans, [
    {
      id: "adhan/bilal-abdulaziz/regular-jiharkah",
      kind: "regular",
      muezzin: { id: "bilal-abdulaziz", name: BILAL },
      maqam: { id: "jiharkah", name: "جهركاه" },
      displayName: BILAL,
      url: "https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3",
      sizeBytes: 1989715,
      durationMs: 313757,
    },
  ]);
});

test("a reminder becomes a reminder entry for its catalog prayer, named تذكير + muezzin name", () => {
  const manifest = buildManifest({
    version: "v1.0.0",
    catalog,
    files: [{ path: "audio/reminders/bilal-abdulaziz/tazkeer.mp3", sizeBytes: 5620114, durationMs: 787540 }],
  });

  assert.deepEqual(manifest.adhans, []);
  assertSameJson(manifest.reminders, [
    {
      id: "reminders/bilal-abdulaziz/tazkeer",
      prayer: "isha",
      muezzin: { id: "bilal-abdulaziz", name: BILAL },
      displayName: "تذكير الأستاذ بلال عبد العزيز",
      url: "https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.0.0/audio/reminders/bilal-abdulaziz/tazkeer.mp3",
      sizeBytes: 5620114,
      durationMs: 787540,
    },
  ]);
});

test("a catalog name replaces a reminder's display name", () => {
  const manifest = buildManifest({
    version: "v1.1.0",
    catalog: {
      ...catalog,
      reminders: { "bilal-abdulaziz/fajr-2": { prayer: "fajr", name: "تذكير بلال 2" } },
    },
    files: [{ path: "audio/reminders/bilal-abdulaziz/fajr-2.mp3", sizeBytes: 1, durationMs: 1 }],
  });

  assert.equal(manifest.reminders[0].prayer, "fajr");
  assert.equal(manifest.reminders[0].displayName, "تذكير بلال 2");
});

test("a reminder missing from catalog.json fails naming the file and the entry to add", () => {
  const message = errorFor(["audio/reminders/bilal-abdulaziz/fajr.mp3"]);
  assert.match(message, /audio\/reminders\/bilal-abdulaziz\/fajr\.mp3/);
  assert.ok(
    message.includes(`"reminders": { "bilal-abdulaziz/fajr": { "prayer": "fajr" | "isha" } }`),
    `message should say what to add to catalog.json:\n${message}`,
  );
});

for (const [why, info, expected] of [
  ["a prayer other than fajr or isha", { prayer: "dhuhr" }, /"prayer" must be "fajr" or "isha"/],
  ["no prayer", {}, /"prayer" must be "fajr" or "isha"/],
  ["an empty name", { prayer: "fajr", name: "" }, /"name" must be a non-empty string/],
]) {
  test(`a reminder with ${why} in catalog.json fails`, () => {
    const message = errorFor(["audio/reminders/bilal-abdulaziz/tazkeer.mp3"], {
      catalog: { ...catalog, reminders: { "bilal-abdulaziz/tazkeer": info } },
    });
    assert.match(message, /audio\/reminders\/bilal-abdulaziz\/tazkeer\.mp3/);
    assert.match(message, expected);
  });
}

test("adhans and reminders are sorted by id regardless of input order", () => {
  const twoMuezzins = {
    muezzins: { ...catalog.muezzins, "ahmad-2": { name: "أحمد" } },
    maqamat: { ...catalog.maqamat, "hijaz-kar": { name: "حجاز كار" } },
    reminders: { ...catalog.reminders, "ahmad-2/tazkeer": { prayer: "fajr" } },
  };
  const f = (path) => ({ path, sizeBytes: 1, durationMs: 1 });
  const manifest = buildManifest({
    version: "v1.0.0",
    catalog: twoMuezzins,
    files: [
      f("audio/reminders/bilal-abdulaziz/tazkeer.mp3"),
      f("audio/adhan/bilal-abdulaziz/regular.mp3"),
      f("audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3"),
      f("audio/reminders/ahmad-2/tazkeer.mp3"),
      f("audio/adhan/bilal-abdulaziz/fajr.mp3"),
      f("audio/adhan/ahmad-2/regular-hijaz-kar.mp3"),
    ],
  });

  assert.deepEqual(
    manifest.adhans.map((a) => a.id),
    [
      "adhan/ahmad-2/regular-hijaz-kar",
      "adhan/bilal-abdulaziz/fajr",
      "adhan/bilal-abdulaziz/regular",
      "adhan/bilal-abdulaziz/regular-jiharkah",
    ],
  );
  assert.deepEqual(manifest.adhans[0].maqam, { id: "hijaz-kar", name: "حجاز كار" });
  assert.deepEqual(
    manifest.reminders.map((r) => r.id),
    ["reminders/ahmad-2/tazkeer", "reminders/bilal-abdulaziz/tazkeer"],
  );
});

/** Runs buildManifest on the given paths and returns the thrown error message. */
function errorFor(paths, options = {}) {
  const version = "version" in options ? options.version : "v1.0.0";
  const cat = options.catalog ?? catalog;
  const files = paths.map((path) => ({ path, sizeBytes: 1, durationMs: 1 }));
  let message;
  assert.throws(
    () => buildManifest({ files, catalog: cat, version }),
    (err) => {
      message = err.message;
      return true;
    },
  );
  return message;
}

test("a muezzin missing from catalog.json fails naming the file and the entry to add", () => {
  const message = errorFor(["audio/adhan/new-muezzin/fajr.mp3"]);
  assert.match(message, /audio\/adhan\/new-muezzin\/fajr\.mp3/);
  assert.ok(
    message.includes(`"muezzins": { "new-muezzin": { "name": "<display name>" } }`),
    `message should say what to add to catalog.json:\n${message}`,
  );
});

test("a maqam missing from catalog.json fails naming the file and the entry to add", () => {
  const message = errorFor(["audio/adhan/bilal-abdulaziz/regular-bayati.mp3"]);
  assert.match(message, /audio\/adhan\/bilal-abdulaziz\/regular-bayati\.mp3/);
  assert.ok(
    message.includes(`"maqamat": { "bayati": { "name": "<display name>" } }`),
    `message should say what to add to catalog.json:\n${message}`,
  );
});

test("ids that collide with built-in object keys are still looked up in catalog.json only", () => {
  const message = errorFor(["audio/adhan/constructor/regular-constructor.mp3"]);
  assert.match(message, /muezzin "constructor" is not in catalog\.json/);
  assert.match(message, /maqam "constructor" is not in catalog\.json/);
});

test("a file missing both its muezzin and its maqam reports both catalog entries", () => {
  const message = errorFor(["audio/adhan/new-muezzin/regular-bayati.mp3"]);
  assert.ok(message.includes(`"muezzins": { "new-muezzin": { "name": "<display name>" } }`), message);
  assert.ok(message.includes(`"maqamat": { "bayati": { "name": "<display name>" } }`), message);
});

test("an adhan whose kind is not regular or fajr fails naming the file and the kind", () => {
  const message = errorFor(["audio/adhan/bilal-abdulaziz/isha-jiharkah.mp3"]);
  assert.match(message, /audio\/adhan\/bilal-abdulaziz\/isha-jiharkah\.mp3/);
  assert.match(message, /unknown adhan kind "isha"/);
  assert.match(message, /"regular" or "fajr"/);
});

for (const [why, path, expected] of [
  ["a non-.mp3 file", "audio/adhan/bilal-abdulaziz/fajr.wav", /only \.mp3 files/],
  ["a stray file like .DS_Store", "audio/.DS_Store", /only \.mp3 files/],
  ["an unknown top-level folder", "audio/takbeer/bilal-abdulaziz/eid.mp3", /must be audio\/adhan\/<muezzin-id>\//],
  ["a file directly under audio/adhan", "audio/adhan/fajr.mp3", /must be audio\/adhan\/<muezzin-id>\//],
  ["an extra folder level", "audio/adhan/bilal-abdulaziz/old/fajr.mp3", /must be audio\/adhan\/<muezzin-id>\//],
  ["uppercase in a file name", "audio/adhan/bilal-abdulaziz/Fajr.mp3", /lowercase/],
  ["uppercase in a muezzin folder", "audio/reminders/Bilal/tazkeer.mp3", /lowercase/],
  ["a space in a reminder name", "audio/reminders/bilal-abdulaziz/my tazkeer.mp3", /lowercase/],
  ["a dangling dash", "audio/adhan/bilal-abdulaziz/regular-.mp3", /lowercase/],
  ["an uppercase extension", "audio/adhan/bilal-abdulaziz/fajr.MP3", /only \.mp3 files/],
]) {
  test(`${why} fails naming the file`, () => {
    const message = errorFor([path]);
    assert.ok(message.includes(path), `message should name ${path}:\n${message}`);
    assert.match(message, expected);
  });
}

test("every problem is reported at once, not just the first", () => {
  const message = errorFor([
    "audio/adhan/new-muezzin/fajr.mp3",
    "audio/adhan/bilal-abdulaziz/fajr.wav",
    "audio/adhan/bilal-abdulaziz/fajr.mp3",
  ]);
  assert.match(message, /new-muezzin/);
  assert.match(message, /fajr\.wav/);
  assert.doesNotMatch(message, /bilal-abdulaziz\/fajr\.mp3/);
});

for (const version of [undefined, "", "1.0.0", "v1.0", "v1.0.0-beta", "v01.0.0x", "latest"]) {
  test(`version ${JSON.stringify(version)} is rejected`, () => {
    const message = errorFor(["audio/adhan/bilal-abdulaziz/fajr.mp3"], { version });
    assert.match(message, /version/);
    assert.match(message, /v1\.2\.3/);
  });
}

test("the tag's major version must equal schemaVersion, because the app reads the @1 range", () => {
  const message = errorFor(["audio/adhan/bilal-abdulaziz/fajr.mp3"], { version: "v2.0.0" });
  assert.match(message, /schemaVersion/);
  assert.match(message, /v1\.x\.y/);
  assert.doesNotThrow(() => buildManifest({ files: [], catalog, version: "v1.42.7" }));
});
