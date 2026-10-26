export const BASE_URL = "https://cdn.jsdelivr.net/gh/yousef-nasser-daaboul/alkannani-audio@";
export const VERSION = /^v\d+\.\d+\.\d+$/;
/** The tag's major version: the app reads the `@<SCHEMA_VERSION>` range, i.e. the newest v1.x.y. */
export const SCHEMA_VERSION = 1;
const ADHAN_KINDS = ["regular", "fajr"];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LAYOUT =
  "paths must be audio/adhan/<muezzin-id>/<regular|fajr>[-<maqam-id>].mp3 " +
  "or audio/reminders/<muezzin-id>/<name>.mp3";

/**
 * @typedef {{ path: string, sizeBytes: number, durationMs: number }} AudioFile
 * @typedef {{ muezzins: Record<string, { name: string }>, maqamat: Record<string, { name: string }> }} Catalog
 */

/**
 * Builds the manifest object from the audio files found under audio/.
 * Throws one Error listing every problem if any file can't be described.
 *
 * @param {{ files: AudioFile[], catalog: Catalog, version: string }} input
 */
export function buildManifest({ files, catalog, version }) {
  if (typeof version !== "string" || !VERSION.test(version)) {
    throw new Error(
      `version must be the git tag the files will be published under, like v1.2.3 (got ${JSON.stringify(version)})`,
    );
  }
  if (Number(version.slice(1).split(".")[0]) !== SCHEMA_VERSION) {
    throw new Error(
      `version ${version}: the major version must equal schemaVersion ${SCHEMA_VERSION} ` +
        `(tags are v${SCHEMA_VERSION}.x.y), because the app reads the newest tag in the @${SCHEMA_VERSION} range`,
    );
  }
  const adhans = [];
  const reminders = [];
  const problems = [];

  for (const file of files) {
    /** @param {string} message */
    const fail = (message) => problems.push(`${file.path}: ${message}`);

    if (!file.path.endsWith(".mp3")) {
      fail("only .mp3 files may live under audio/ (remove or move this file)");
      continue;
    }
    const parts = file.path.slice(0, -".mp3".length).split("/");
    const [root, category, muezzinId, stem] = parts;
    if (parts.length !== 4 || root !== "audio" || (category !== "adhan" && category !== "reminders")) {
      fail(LAYOUT);
      continue;
    }
    if (!ID.test(muezzinId) || !ID.test(stem)) {
      fail("folder and file names must be lowercase kebab-case ids (a-z, 0-9, single dashes)");
      continue;
    }

    const id = `${category}/${muezzinId}/${stem}`;
    const url = `${BASE_URL}${version}/${file.path}`;
    const muezzinName = lookup(catalog, "muezzins", muezzinId, fail);

    if (category === "reminders") {
      if (muezzinName === undefined) continue;
      const muezzin = { id: muezzinId, name: muezzinName };
      reminders.push({
        id,
        muezzin,
        displayName: `تذكير ${muezzin.name}`,
        url,
        sizeBytes: file.sizeBytes,
        durationMs: file.durationMs,
      });
      continue;
    }

    const dash = stem.indexOf("-");
    const kind = dash === -1 ? stem : stem.slice(0, dash);
    const maqamId = dash === -1 ? null : stem.slice(dash + 1);
    if (!ADHAN_KINDS.includes(kind)) {
      fail(
        `unknown adhan kind "${kind}". ` +
          `Adhan file names must be "regular" or "fajr", optionally followed by -<maqam-id> (e.g. regular-jiharkah.mp3)`,
      );
      continue;
    }
    const maqamName = maqamId === null ? null : lookup(catalog, "maqamat", maqamId, fail);
    if (muezzinName === undefined || maqamName === undefined) continue;
    const muezzin = { id: muezzinId, name: muezzinName };

    adhans.push({
      id,
      kind,
      muezzin,
      maqam: maqamId === null ? null : { id: maqamId, name: maqamName },
      displayName: muezzin.name,
      url,
      sizeBytes: file.sizeBytes,
      durationMs: file.durationMs,
    });
  }

  if (problems.length > 0) {
    throw new Error(`manifest not generated:\n  - ${problems.join("\n  - ")}`);
  }
  adhans.sort(byId);
  reminders.sort(byId);
  return { schemaVersion: SCHEMA_VERSION, version, adhans, reminders };
}

/** Plain code-unit order, so output never depends on the machine's locale. */
function byId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Returns catalog[section][id].name, or reports what to add to catalog.json
 * and returns undefined.
 *
 * @param {Catalog} catalog
 * @param {"muezzins" | "maqamat"} section
 * @param {string} id
 * @param {(message: string) => void} fail
 */
function lookup(catalog, section, id, fail) {
  const entries = catalog[section] ?? {};
  const name = Object.hasOwn(entries, id) ? entries[id]?.name : undefined;
  if (typeof name === "string") return name;
  const what = section === "muezzins" ? "muezzin" : "maqam";
  fail(
    `${what} "${id}" is not in catalog.json. ` +
      `Add to catalog.json: "${section}": { "${id}": { "name": "<display name>" } }`,
  );
  return undefined;
}
