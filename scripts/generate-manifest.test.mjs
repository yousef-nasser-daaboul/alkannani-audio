import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readAudioFiles, writeManifest } from "./generate-manifest.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const REAL_FAJR = path.join(repoRoot, "audio/adhan/bilal-abdulaziz/fajr.mp3");
const catalog = {
  muezzins: { "bilal-abdulaziz": { name: "الأستاذ بلال عبد العزيز" } },
  maqamat: { jiharkah: { name: "جهركاه" } },
};

/**
 * Makes a throwaway repo root holding catalog.json and copies of the real fajr.mp3
 * at each given path.
 */
async function makeRoot(t, mp3Paths) {
  const root = await mkdtemp(path.join(tmpdir(), "alkannani-audio-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "catalog.json"), JSON.stringify(catalog));
  for (const p of mp3Paths) {
    await mkdir(path.dirname(path.join(root, p)), { recursive: true });
    await copyFile(REAL_FAJR, path.join(root, p));
  }
  return root;
}

test("reads exact size and full-frame duration of the real audio files", async () => {
  const files = await readAudioFiles(repoRoot);
  files.sort((a, b) => (a.path < b.path ? -1 : 1));

  // Sizes from the filesystem; durations from counting MPEG frames by hand
  // (10892 / 12011 / 30148 frames x 1152 samples at 44.1 kHz).
  assert.deepEqual(files, [
    { path: "audio/adhan/bilal-abdulaziz/fajr.mp3", sizeBytes: 1825522, durationMs: 284526 },
    { path: "audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3", sizeBytes: 1989715, durationMs: 313757 },
    { path: "audio/reminders/bilal-abdulaziz/tazkeer.mp3", sizeBytes: 5620114, durationMs: 787540 },
  ]);
});

test("writes manifest.json as 2-space JSON with a trailing LF", async (t) => {
  const root = await makeRoot(t, ["audio/adhan/bilal-abdulaziz/fajr.mp3"]);

  await writeManifest({ root, version: "v1.3.4" });

  const text = await readFile(path.join(root, "manifest.json"), "utf8");
  assert.equal(
    text,
    `{
  "schemaVersion": 1,
  "version": "v1.3.4",
  "adhans": [
    {
      "id": "adhan/bilal-abdulaziz/fajr",
      "kind": "fajr",
      "muezzin": {
        "id": "bilal-abdulaziz",
        "name": "الأستاذ بلال عبد العزيز"
      },
      "maqam": null,
      "displayName": "الأستاذ بلال عبد العزيز",
      "url": "https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@v1.3.4/audio/adhan/bilal-abdulaziz/fajr.mp3",
      "sizeBytes": 1825522,
      "durationMs": 284526
    }
  ],
  "reminders": []
}
`,
  );
});

test("running twice on the same files and version gives byte-identical output", async (t) => {
  const root = await makeRoot(t, [
    "audio/adhan/bilal-abdulaziz/regular-jiharkah.mp3",
    "audio/adhan/bilal-abdulaziz/fajr.mp3",
    "audio/reminders/bilal-abdulaziz/tazkeer.mp3",
  ]);
  const manifestPath = path.join(root, "manifest.json");

  await writeManifest({ root, version: "v1.0.0" });
  const first = await readFile(manifestPath);
  await writeManifest({ root, version: "v1.0.0" });
  const second = await readFile(manifestPath);

  assert.ok(first.equals(second));
});

for (const args of [[], ["1.0.0"], ["latest"]]) {
  test(`the CLI with arguments ${JSON.stringify(args)} exits non-zero and writes nothing`, async () => {
    const manifestPath = path.join(repoRoot, "manifest.json");
    const before = await readFile(manifestPath).catch(() => null);

    const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts/generate-manifest.mjs"), ...args], {
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /usage: npm run manifest -- v1\.2\.3/i);
    const after = await readFile(manifestPath).catch(() => null);
    assert.deepEqual(after, before);
  });
}

for (const [why, badPath, expected] of [
  ["a muezzin missing from catalog.json", "audio/adhan/new-muezzin/fajr.mp3", /"new-muezzin"/],
  ["a stray non-mp3 file", "audio/adhan/bilal-abdulaziz/notes.txt", /only \.mp3 files/],
]) {
  test(`${why} fails without touching an existing manifest.json`, async (t) => {
    const root = await makeRoot(t, ["audio/adhan/bilal-abdulaziz/fajr.mp3", badPath]);
    const manifestPath = path.join(root, "manifest.json");
    await writeFile(manifestPath, "previous manifest\n");

    await assert.rejects(writeManifest({ root, version: "v1.0.0" }), (err) => {
      assert.ok(err.message.includes(badPath), err.message);
      assert.match(err.message, expected);
      return true;
    });
    assert.equal(await readFile(manifestPath, "utf8"), "previous manifest\n");
  });
}

test("an unreadable mp3 fails with its path in the message", async (t) => {
  const root = await makeRoot(t, []);
  const broken = "audio/adhan/bilal-abdulaziz/fajr.mp3";
  await mkdir(path.dirname(path.join(root, broken)), { recursive: true });
  await writeFile(path.join(root, broken), "");
  await assert.rejects(readAudioFiles(root), (err) => {
    assert.match(err.message, /audio\/adhan\/bilal-abdulaziz\/fajr\.mp3/);
    return true;
  });
});
