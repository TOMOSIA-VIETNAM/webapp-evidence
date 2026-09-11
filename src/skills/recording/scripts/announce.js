#!/usr/bin/env node
// Puts a notice on the screen of whoever is sitting at this machine, and waits for them to
// press it.
//
// It exists as its own command because of the order the consent has to happen in. The person
// about to have their screen recorded is not necessarily looking at the terminal the agent is
// running in — they may not know a recording was asked for at all. So the notice comes first,
// on top of whatever they are actually looking at, and it tells them where the question is.
// The question itself is asked by the agent, in the terminal, where an answer can be given.
//
// The sentence is written by the caller rather than chosen from a list here. The agent is
// already talking to this person in their own language, whatever it is; a list would have
// offered three, and the one person who has to understand this would be the one it was written
// past.
//
// Nothing is recorded by this command. It shows a sentence, waits, and exits.
const { spawn } = require('child_process');

const DEFAULT_WAIT_SECONDS = 300;

function help() {
  console.log(`Show a notice on the screen of whoever is at this machine, and wait for it.

  node announce.js --message <text> [--seconds N]

    --message   what it says. Write it in the language the person reads.
    --seconds   how long to wait for it to be pressed (default ${DEFAULT_WAIT_SECONDS})

The first line is the heading, and what follows a blank line is the body. Say four things, or
the notice does not do its job:

  1. nothing is being recorded yet, and nothing will be until they agree
  2. turn on Do Not Disturb, naming where — on macOS, System Settings > Focus > Do Not Disturb.
     Say the path, not the words alone: the point is that they can act on it without looking
  3. press OK and go back to the terminal, where the question is waiting
  4. the machine should be left alone once they answer

For example:

  node announce.js --message "Yêu cầu quay màn hình
  
  Chưa quay gì cả, và sẽ không quay cho tới khi bạn đồng ý.
  
  1. Bật Do Not Disturb: System Settings > Focus > Do Not Disturb
  2. Bấm OK, rồi quay lại cửa sổ terminal — câu hỏi đang chờ ở đó
  
  Trả lời xong là bắt đầu quay. Đừng dùng máy cho tới khi xong."

It waits to be pressed, because a notice that dismisses itself is one the person it was meant
for may never see.

Exits 0 once it is pressed, and 0 on a machine with no windowing session, where it prints the
sentence instead. Exits 1 if nobody pressed it: that is nobody at the machine, not consent.`);
}

function parse(argv) {
  const options = { message: null, seconds: DEFAULT_WAIT_SECONDS };
  const fields = { '--message': 'message', '--seconds': 'seconds' };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=');
    const field = fields[flag];
    // The name of the option is reported, not the value that followed it: consuming the next
    // argument before knowing the flag is valid is how "--colour red" comes back as "red".
    if (!field) throw new Error(`Unknown option: ${flag}\nRun with --help.`);
    const value = inline ?? argv[++i];
    options[field] = field === 'seconds' ? Number(value) : value;
  }
  if (!options.message || !String(options.message).trim()) {
    throw new Error('--message is required: write what the notice should say.\nRun with --help.');
  }
  if (!Number.isFinite(options.seconds) || options.seconds <= 0) {
    throw new Error(`--seconds must be a positive number, got ${JSON.stringify(options.seconds)}`);
  }
  return options;
}

// An AppleScript alert floats above every application, which is the whole point: the person is
// looking at something else. `display alert` rather than `display dialog` because it sets the
// first line as a heading and gives the rest room to be a list — a dialog renders the lot as one
// grey paragraph, which is how a notice this one asks someone to act on gets skimmed.
//
// The wait is bounded all the same, generously, and running out is abandonment rather than
// consent: nobody was at the machine, so nothing should be recorded of it.
function showNotice(message, timeoutSeconds) {
  if (process.platform !== 'darwin') return Promise.resolve('unavailable');

  return new Promise((resolve) => {
    // The first line is the heading and the rest is the body, so the caller writes one string
    // and still gets something laid out.
    const [heading, ...rest] = String(message).split(/\n\s*\n/);
    const body = rest.join('\n\n').trim();

    const dialog = spawn('osascript', [
      '-e',
      `display alert ${JSON.stringify(heading.trim())} `
      + (body ? `message ${JSON.stringify(body)} ` : '')
      + 'as informational buttons {"OK"} default button 1',
    ], { stdio: 'ignore' });

    const abandon = setTimeout(() => {
      dialog.kill('SIGTERM');
      resolve('unanswered');
    }, timeoutSeconds * 1000);

    dialog.on('exit', (code) => {
      clearTimeout(abandon);
      // Killed on the timeout, or there is no windowing session to show it in
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
  const { message, seconds } = parse(argv);
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

module.exports = { parse, showNotice, DEFAULT_WAIT_SECONDS };
