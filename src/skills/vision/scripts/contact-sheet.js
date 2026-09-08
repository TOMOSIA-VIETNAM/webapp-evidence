#!/usr/bin/env node
// Turn a recording into contact sheets an agent can look at: frames sampled at a fixed interval,
// each stamped with the second it came from, tiled into a grid.
//
// The reason this exists rather than "read the screenshots": screenshots are taken at the moments a
// step script decided to capture, so they show what someone already knew to look for. A sheet shows
// the whole take at an even cadence, including the moments nobody thought to capture — which is
// where a layout that breaks halfway through a transition, or an error banner that appears and
// disappears, actually lives.
//
// The timestamp on each tile is what makes a sheet answerable: without it a finding is "somewhere in
// the video", and with it the reader goes straight to 00:12 in the mp4 or to the runbook line that
// covers it.
//
// Usage: node contact-sheet.js <video.mp4> [options]   (see --help)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULTS = {
  every: 2,       // seconds between sampled frames
  columns: 4,
  rows: 5,        // 20 tiles a sheet: enough of the take to follow, small enough to still read
  tile: 480,      // width of one tile; 4 x 480 = a 1920px sheet
};

// drawtext needs a font, and how it finds one differs per machine: a build with fontconfig takes a
// family name, one without needs an absolute path. Try the paths first, since a wrong family name
// fails at render time with the frames already sampled.
const FONT_CANDIDATES = [
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
];

function help() {
  console.log(`Tile a recording into contact sheets, one frame every few seconds, each stamped with its time.

  node contact-sheet.js <video.mp4> [options]

    --every <seconds>   sample one frame this often (default ${DEFAULTS.every})
    --columns <n>       tiles across (default ${DEFAULTS.columns})
    --rows <n>          tiles down (default ${DEFAULTS.rows})
    --tile <px>         width of one tile (default ${DEFAULTS.tile})
    --out <dir>         where to write (default: beside the video)

Writes <name>-sheet-01.png, -02.png … one per ${DEFAULTS.columns * DEFAULTS.rows} tiles, and prints
what each sheet covers so you can name a time when you report what you saw.`);
}

function parseArgs(argv) {
  const args = { options: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--every') args.options.every = Number(argv[++i]);
    else if (a === '--columns') args.options.columns = Number(argv[++i]);
    else if (a === '--rows') args.options.rows = Number(argv[++i]);
    else if (a === '--tile') args.options.tile = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else rest.push(a);
  }
  args.video = rest[0];
  return args;
}

// A number that arrived but makes no sense is a mistake worth naming here. Dropping it silently
// leaves the user with defaults they did not ask for, or with an ffmpeg error that mentions
// `fps=1/0` and nothing about the flag they typed.
function resolveOptions(overrides) {
  const options = { ...DEFAULTS };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`--${key} must be a number greater than zero`);
    }
    options[key] = value;
  }
  return options;
}

function findFont() {
  return FONT_CANDIDATES.find((file) => fs.existsSync(file)) ?? null;
}

function durationOf(video) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'csv=p=0', video], { encoding: 'utf8' });
  const seconds = Number(String(out).trim());
  if (!Number.isFinite(seconds)) throw new Error(`Cannot read the duration of ${video}`);
  return seconds;
}

const mmss = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
};

// The label is drawn from the frame's own timestamp, so it stays correct no matter which frames the
// sampling picked. Without a font the sheet is still worth making — it just cannot be cited.
function labelFilter(font, tileWidth) {
  if (!font) return null;
  const size = Math.max(14, Math.round(tileWidth / 24));
  return [
    `drawtext=fontfile='${font}'`,
    // mm:ss, the same shape the runbook's timeline uses, so a finding on a sheet and a line in the
    // runbook can be matched without converting anything.
    "text='%{eif\\:trunc(t/60)\\:d\\:2}\\:%{eif\\:mod(trunc(t)\\,60)\\:d\\:2}'",
    `fontsize=${size}`,
    'fontcolor=white',
    'box=1', 'boxcolor=0x000000cc', `boxborderw=${Math.round(size / 3)}`,
    `x=${Math.round(size / 2)}`, `y=${Math.round(size / 2)}`,
  ].join(':');
}

function buildFilter({ every, columns, rows, tile }, font) {
  return [
    `fps=1/${every}`,
    `scale=${tile}:-1:flags=lanczos`,
    labelFilter(font, tile),
    `tile=${columns}x${rows}:padding=6:margin=6:color=0x1f2937`,
  ].filter(Boolean).join(',');
}

// What each sheet covers, so whoever reads it can say "the header overlaps at 00:14" instead of
// "somewhere in the second sheet".
function sheetRanges(duration, { every, columns, rows }) {
  const perSheet = columns * rows;
  const frames = Math.max(1, Math.ceil(duration / every));
  const sheets = Math.max(1, Math.ceil(frames / perSheet));
  return Array.from({ length: sheets }, (_, i) => ({
    index: i + 1,
    from: i * perSheet * every,
    to: Math.min((i + 1) * perSheet * every, duration),
  }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.video) {
    help();
    process.exit(args.video ? 0 : 1);
  }

  const video = path.resolve(args.video);
  if (!fs.existsSync(video)) throw new Error(`No such video: ${video}`);

  const options = resolveOptions(args.options);
  const outDir = args.out ? path.resolve(args.out) : path.dirname(video);
  fs.mkdirSync(outDir, { recursive: true });

  const font = findFont();
  const name = path.basename(video, path.extname(video));
  const pattern = path.join(outDir, `${name}-sheet-%02d.png`);

  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video,
    '-vf', buildFilter(options, font), '-vsync', 'vfr', pattern]);

  const sheets = fs.readdirSync(outDir)
    .filter((f) => f.startsWith(`${name}-sheet-`) && f.endsWith('.png'))
    .sort();
  if (!sheets.length) throw new Error('ffmpeg produced no sheets — is the video shorter than one sampling interval?');

  const ranges = sheetRanges(durationOf(video), options);
  console.log(`${sheets.length} sheet(s), one frame every ${options.every}s, ${options.columns}x${options.rows} per sheet:`);
  sheets.forEach((file, i) => {
    const range = ranges[i];
    const covers = range ? `${mmss(range.from)}–${mmss(range.to)}` : '';
    console.log(`  ${path.join(outDir, file)}  ${covers}`);
  });
  if (!font) {
    console.log('\nNo usable font found, so the tiles carry no timestamps.');
    console.log(`Frame N on sheet S is at ${options.every} x ((S-1) x ${options.columns * options.rows} + N-1) seconds.`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(String((e && e.message) || e));
    process.exit(1);
  }
}

module.exports = { DEFAULTS, parseArgs, resolveOptions, buildFilter, sheetRanges, mmss, findFont };
