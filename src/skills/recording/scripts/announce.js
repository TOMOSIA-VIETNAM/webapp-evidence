#!/usr/bin/env node
// Puts a notice on the screen of whoever is sitting at the machine.
//
// It exists as its own command because of the order the consent has to happen in. The person
// who is about to have their screen recorded is not necessarily looking at the terminal the
// agent is running in — they may not even know a recording was asked for. So the notice comes
// first, on top of whatever they are actually looking at, and it tells them where the question
// is. The question itself is asked by the agent, in the terminal, where an answer can be given.
//
// Nothing is recorded by this command. It shows a sentence and exits.
const { execFileSync } = require('child_process');
const { noticeText, LOCALE_KEYS, assertLocale } = require('./captions');

const KINDS = {
  // Shown before anything is asked: the recording has been requested and needs an answer
  confirm: 'screenCaptureConfirm',
  // Shown once the answer is yes, immediately before the first frame
  starting: 'screenCaptureStarting',
};

function help() {
  console.log(`Show a notice on the screen of whoever is at this machine.

  node announce.js --kind confirm|starting [--locale ${LOCALE_KEYS.join('|')}] [--seconds N]

    --kind confirm    a recording has been asked for, and a question is waiting in the terminal
    --kind starting   the recording begins now, do not touch the machine
    --locale          the language the person at the machine reads (default en)
    --seconds         how long the notice stays up before dismissing itself (default 6)

Records nothing. Shows a sentence and exits. On a machine with no windowing session it prints
the sentence instead, and still exits 0: a notice that could not be shown is not a failure of
the recording.`);
}

function parse(argv) {
  const options = { kind: null, locale: 'en', seconds: 6 };
  const fields = { '--kind': 'kind', '--locale': 'locale', '--seconds': 'seconds' };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=');
    const field = fields[flag];
    // The name of the option is reported, not the value that followed it: consuming the next
    // argument before knowing the flag is valid is how "--colour red" comes back as "red".
    if (!field) throw new Error(`Unknown option: ${flag}\nRun with --help.`);
    const value = inline ?? argv[++i];
    options[field] = field === 'seconds' ? Number(value) : value;
  }
  if (!KINDS[options.kind]) {
    throw new Error(`--kind must be one of ${Object.keys(KINDS).join(' | ')}, got ${JSON.stringify(options.kind)}`);
  }
  assertLocale(options.locale, '--locale');
  if (!Number.isFinite(options.seconds) || options.seconds <= 0) {
    throw new Error(`--seconds must be a positive number, got ${JSON.stringify(options.seconds)}`);
  }
  return options;
}

// An AppleScript dialog floats above every application, which is the whole point: the person is
// looking at something else. It dismisses itself, so a notice nobody is at the machine to read
// cannot stall a recording indefinitely.
function show(message, seconds) {
  if (process.platform !== 'darwin') return false;
  try {
    execFileSync('osascript', [
      '-e',
      `display dialog ${JSON.stringify(message)} buttons {"OK"} default button 1 `
      + `with title "webapp-evidence" giving up after ${Math.round(seconds)}`,
    ], { stdio: 'ignore' });
    return true;
  } catch {
    return false;   // no windowing session, or automation is not permitted
  }
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h') || !argv.length) {
    help();
    process.exit(argv.length ? 0 : 1);
  }
  const { kind, locale, seconds } = parse(argv);
  const message = noticeText(KINDS[kind], locale);
  if (!show(message, seconds)) console.log(message);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(String((error && error.message) || error));
    process.exit(1);
  }
}

module.exports = { parse, KINDS };
