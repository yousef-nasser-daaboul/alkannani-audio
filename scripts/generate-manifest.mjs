// Generates manifest.json from the files under audio/ and catalog.json.
// Usage: node scripts/generate-manifest.mjs v1.0.0   (or: npm run manifest -- v1.0.0)

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFile } from "music-metadata";
import { buildManifest, VERSION } from "./manifest.mjs";

/**
 * Reads catalog.json and audio/ under root and writes root/manifest.json.
 * Everything is validated before the write, so a failure leaves any existing
 * manifest.json untouched.
 *
 * @param {{ root: string, version: string }} options
 * @returns {Promise<string>} the text written
 */
export async function writeManifest({ root, version }) {
  const catalog = JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8"));
  const files = await readAudioFiles(root);
  const text = JSON.stringify(buildManifest({ files, catalog, version }), null, 2) + "\n";
  await writeFile(path.join(root, "manifest.json"), text, "utf8");
  return text;
}

/**
 * Lists every file under <root>/audio with its exact byte size and, for .mp3
 * files, its full-frame duration. Other files get durationMs null and are
 * rejected later by buildManifest.
 *
 * @param {string} root repo root
 * @returns {Promise<import("./manifest.mjs").AudioFile[]>}
 */
export async function readAudioFiles(root) {
  const entries = await readdir(path.join(root, "audio"), { recursive: true, withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const { size } = await stat(absolute);
    files.push({
      path: relative,
      sizeBytes: size,
      durationMs: relative.endsWith(".mp3") ? await probeDurationMs(absolute, relative) : null,
    });
  }
  return files;
}

/**
 * Duration from the MPEG frame count (Xing/LAME header, or a full scan of
 * every frame when there is none), so it is exact for VBR files too.
 */
async function probeDurationMs(absolute, relative) {
  const duration = await parseFile(absolute, { duration: true }).then(
    ({ format }) => format.duration,
    () => undefined,
  );
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`${relative}: could not determine the duration; is it a valid MP3?`);
  }
  return Math.round(duration * 1000);
}

// Not import.meta.main: on Node versions without it the release step would silently do nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !VERSION.test(args[0])) {
    console.error(
      "usage: npm run manifest -- v1.2.3\n" +
        "The version is required: the git tag (vMAJOR.MINOR.PATCH) these files will be published under.\n" +
        `got: ${args.length === 0 ? "nothing" : args.join(" ")}`,
    );
    process.exit(1);
  }
  const root = path.join(import.meta.dirname, "..");
  try {
    await writeManifest({ root, version: args[0] });
    console.log(`wrote manifest.json for ${args[0]}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
