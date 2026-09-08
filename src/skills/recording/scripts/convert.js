#!/usr/bin/env node
// Convert a take to another format. The runner writes mp4 because that is what plays everywhere and
// stays small, but an mp4 is not what every destination accepts: a GitHub comment or a README embeds
// a gif, a web page wants webm, and a chat tool may take either.
//
// Usage: node convert.js <video.mp4> --to gif[,webm] [options]   (see --help)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Each format is a pair of ffmpeg passes at most. The settings are the ones that survived a side by
// side comparison of the same take: a palette built from the footage rather than the default web
// palette, and no dithering — dither exists to fake colours in photographs, and on flat UI greys it
// sprays noise over small text.
const FORMATS = {
  gif: {
    extension: '.gif',
    // Wider than the size it will be displayed at: a gif scaled UP by the browser looks soft, and
    // that softness is added at display time where no amount of encoding effort can undo it.
    defaults: { fps: 8, width: 1024, colors: 128 },
    describe: (o) => `${o.width}px, ${o.fps}fps, ${o.colors} colours`,
  },
  webm: {
    extension: '.webm',
    // VP9 at crf 34 holds a screen recording well; -b:v 0 puts crf in charge of the bitrate rather
    // than letting it cap quality. Screen content has large flat areas, so this lands far under the
    // mp4 for the same footage.
    defaults: { crf: 34, width: 0 },
    describe: (o) => (o.width ? `${o.width}px, ` : 'source size, ') + `crf ${o.crf}`,
  },
};

function help() {
  console.log(`Convert a recording to another format.

  node convert.js <video.mp4> --to <format>[,<format>…] [options]

    --to <list>      gif, webm, or both: --to gif,webm
    --width <px>     scale the output (gif defaults to 1024, webm keeps the source size)
    --fps <n>        gif only, default 8
    --colors <n>     gif only, default 128
    --crf <n>        webm only, default 34 — lower is better quality and a bigger file
    --out <dir>      where to write (default: beside the video)

Each output is written next to the video unless --out says otherwise, and the size of every file
produced is printed. Nothing is overwritten without being named on the command line.`);
}

function parseArgs(argv) {
  const args = { formats: [], options: {} };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to') args.formats = String(argv[++i] || '').split(',').map((f) => f.trim()).filter(Boolean);
    else if (a === '--width') args.options.width = Number(argv[++i]);
    else if (a === '--fps') args.options.fps = Number(argv[++i]);
    else if (a === '--colors') args.options.colors = Number(argv[++i]);
    else if (a === '--crf') args.options.crf = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else rest.push(a);
  }
  args.video = rest[0];
  return args;
}

// A format named wrong is worth stopping for: the alternative is writing nothing and saying nothing,
// and the user finds out when the file they expected is not there.
function assertFormats(formats) {
  if (!formats.length) {
    throw new Error(`Nothing to convert to. Pass --to with one of: ${Object.keys(FORMATS).join(', ')}`);
  }
  const unknown = formats.filter((f) => !FORMATS[f]);
  if (unknown.length) {
    throw new Error(
      `Cannot convert to ${unknown.join(', ')}.\n` +
      `Known formats: ${Object.keys(FORMATS).join(', ')}.`
    );
  }
}

const scaleFilter = (width) => (width ? `scale=${width}:-1:flags=lanczos` : null);

// Two passes, because a palette computed from this footage beats the generic one by a wide margin on
// UI screenshots — flat greys and antialiased text are exactly what the default palette handles
// worst.
function toGif(video, target, { fps, width, colors }) {
  const palette = path.join(path.dirname(target), `.${path.basename(target)}.palette.png`);
  const chain = [`fps=${fps}`, scaleFilter(width)].filter(Boolean).join(',');
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video,
      '-vf', `${chain},palettegen=stats_mode=diff:max_colors=${colors}`, palette]);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', palette,
      '-lavfi', `${chain}[v];[v][1:v]paletteuse=dither=none`, target]);
  } finally {
    fs.rmSync(palette, { force: true });
  }
}

function toWebm(video, target, { crf, width }) {
  const filter = scaleFilter(width);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', video,
    ...(filter ? ['-vf', filter] : []),
    '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0',
    '-row-mt', '1', '-an', target]);
}

const humanSize = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.round(bytes / 1024)} KB`);

function convert(video, format, outDir, overrides) {
  const spec = FORMATS[format];
  const options = { ...spec.defaults, ...Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => Number.isFinite(v))
  ) };
  const target = path.join(outDir, `${path.basename(video, path.extname(video))}${spec.extension}`);

  if (format === 'gif') toGif(video, target, options);
  else toWebm(video, target, options);

  return { target, options, size: fs.statSync(target).size };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.video) {
    help();
    process.exit(args.video ? 0 : 1);
  }

  const video = path.resolve(args.video);
  if (!fs.existsSync(video)) throw new Error(`No such video: ${video}`);
  assertFormats(args.formats);

  const outDir = args.out ? path.resolve(args.out) : path.dirname(video);
  fs.mkdirSync(outDir, { recursive: true });

  for (const format of args.formats) {
    const { target, options, size } = convert(video, format, outDir, args.options);
    console.log(`${format.toUpperCase().padEnd(5)} ${target}  (${humanSize(size)}, ${FORMATS[format].describe(options)})`);
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

module.exports = { FORMATS, parseArgs, assertFormats, convert };
