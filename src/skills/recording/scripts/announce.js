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
const { spawn } = require('child_process');
const { noticeText, LOCALE_KEYS, assertLocale } = require('./captions');

// One notice, shown before the question is asked. There is deliberately no second one after
// the answer: the answer is the handover, and another dialog would send the person back to a
// screen they had already left.
const KINDS = {
  confirm: 'screenCaptureConfirm',
};

function help() {
  console.log(`Show a notice on the screen of whoever is at this machine.

  node announce.js --kind confirm [--locale ${LOCALE_KEYS.join('|')}] [--seconds N]

    --kind confirm    a recording has been asked for, and a question is waiting in the terminal
    --locale          the language the person at the machine reads (default en)
    --seconds         how long to wait for it to be pressed before giving up (default 300)

Records nothing. It waits for the notice to be pressed, because a notice that dismisses itself
is one the person it was meant for may never see.

Exits 0 once it is pressed, and 0 on a machine with no windowing session, where it prints the
sentence instead. Exits 1 if nobody pressed it: that is nobody at the machine, not consent.`);
}

function parse(argv) {
  const options = { kind: null, locale: 'en', seconds: 300 };
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
// looking at something else.
//
// It waits to be pressed. A notice that dismisses itself after a few seconds is one the person
// it was meant for may never see, and this is the notice that tells them their screen is about
// to be recorded — the one thing they have to have seen.
//
// The wait is bounded all the same, generously, and running out is abandonment rather than
// consent: nobody was at the machine, so nothing should be recorded of it.
function showNotice(message, timeoutSeconds) {
  if (process.platform !== 'darwin') return Promise.resolve('unavailable');

  return new Promise((resolve) => {
    const dialog = spawn('osascript', [
      '-e',
      `display dialog ${JSON.stringify(message)} buttons {"OK"} default button 1 `
      + 'with title "webapp-evidence"',
    ], { stdio: 'ignore' });

    const abandon = setTimeout(() => {
      dialog.kill('SIGTERM');
      resolve('unanswered');
    }, timeoutSeconds * 1000);

    dialog.on('exit', (code) => {
      clearTimeout(abandon);
      // Killed on the timeout, or the person has no windowing session to show it in
      if (code === 0) resolve('acknowledged');
      else resolve(dialog.killed ? 'unanswered' : 'unavailable');
    });
    dialog.on('error', () => { clearTimeout(abandon); resolve('unavailable'); });
  });
}

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h') || !argv.length) {
    help();
    process.exit(argv.length ? 0 : 1);
  }
  const { kind, locale, seconds } = parse(argv);
  const message = noticeText(KINDS[kind], locale);
  const outcome = await showNotice(message, seconds);

  if (outcome === 'unavailable') {
    console.log(message);
    return;
  }
  if (outcome === 'unanswered') {
    throw new Error(
      `Nobody pressed the notice within ${seconds}s, so nobody is at that machine.\n` +
      'Do not record its screen: ask again when they are back.'
    );
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(String((error && error.message) || error));
    process.exit(1);
  });
}

module.exports = { parse, showNotice, KINDS };
