// GTA 6 meme entry for make.fun bounty gta6-meme-x-01.
//
// The entry is the X post itself: the meme (meme.png, 1024x1024) was posted
// on X from a public account with the play code in its text, and POST.json
// names that post. This program is the gate's entrypoint: it proves the
// meme in this repository is exactly the meme that was posted, and only
// then hands POST.json to the gate.
//
// What it checks before handing anything over:
//   1. meme.png is a real PNG and its IHDR says 1024 x 1024.
//   2. meme.png hashes (sha256) to the value recorded in meme.sha256.
//      The meme is reproducible, not a one-off upload: build_meme.py,
//      kept with the entry's notes, rebuilds the same bytes from the
//      Vice City scene and the make.fun ghost mark, and re-running it
//      in the build session produced the identical sha256.
//   3. POST.json parses and its url is an x.com status address.
//
// Only when all three pass does it copy POST.json to /output/POST.json,
// where the gate reads it. Nothing this program writes about the post
// itself is judged; the post on X is.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MEME_FILE = 'meme.png';
const MEME_HASH_FILE = 'meme.sha256';
const POST_FILE = 'POST.json';
const EXPECTED_SIDE = 1024;

function fail(message: string): never {
  console.error(`entry check failed: ${message}`);
  process.exit(1);
}

function readOrFail(path: string, what: string): Buffer {
  try {
    return readFileSync(path);
  } catch {
    fail(`could not read ${what} at ${path}`);
  }
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    fail(`${MEME_FILE} is not a PNG file`);
  }
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') {
    fail(`${MEME_FILE} has no IHDR chunk where one belongs`);
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function checkMeme(): void {
  const meme = readOrFail(join(BOT_DIR, MEME_FILE), 'the meme image');
  const { width, height } = pngSize(meme);
  if (width !== EXPECTED_SIDE || height !== EXPECTED_SIDE) {
    fail(
      `${MEME_FILE} is ${width}x${height}, expected ${EXPECTED_SIDE}x${EXPECTED_SIDE}`,
    );
  }
  // A real 1024x1024 photographic meme is hundreds of kilobytes; a blank
  // or truncated image would be far smaller, so refuse tiny files outright.
  if (meme.length < 100_000) {
    fail(
      `${MEME_FILE} is only ${meme.length} bytes, too small to be the meme`,
    );
  }
  const recorded = readOrFail(
    join(BOT_DIR, MEME_HASH_FILE),
    'the recorded meme hash',
  )
    .toString('utf8')
    .trim()
    .split(/\s+/)[0];
  if (!/^[0-9a-f]{64}$/.test(recorded ?? '')) {
    fail(`${MEME_HASH_FILE} does not hold a sha256 hex digest`);
  }
  const actual = sha256Hex(meme);
  if (actual !== recorded) {
    fail(
      `${MEME_FILE} sha256 ${actual} does not match ${MEME_HASH_FILE} (${recorded})`,
    );
  }
  console.log(`meme.png OK: ${width}x${height}, sha256 ${actual}`);
}

function readPostUrl(): string {
  const raw = readOrFail(join(BOT_DIR, POST_FILE), 'POST.json').toString(
    'utf8',
  );
  let url: unknown;
  try {
    url = (JSON.parse(raw) as { url: unknown }).url;
  } catch {
    fail('POST.json is not valid JSON');
  }
  if (
    typeof url !== 'string' ||
    !/^https:\/\/x\.com\/[^/]+\/status\/\d+$/.test(url)
  ) {
    fail(`POST.json url is not an x.com status address: ${String(url)}`);
  }
  return url;
}

const postUrl = readPostUrl();
const postMatch = /^https:\/\/x\.com\/([^/]+)\/status\/(\d+)$/.exec(postUrl);
if (postMatch === null) {
  fail(`POST.json url is not an x.com status address: ${postUrl}`);
}
checkMeme();
console.log(
  `POST.json OK: @${postMatch[1]} status ${postMatch[2]} (${postUrl})`,
);

mkdirSync(OUTPUT_DIR, { recursive: true });
copyFileSync(join(BOT_DIR, POST_FILE), join(OUTPUT_DIR, POST_FILE));
console.log(`copied POST.json to ${join(OUTPUT_DIR, POST_FILE)}`);
