// Covering text the terminal panel produces, with the patterns the project wrote.
//
// Nothing is covered by default. The runner does not guess what is sensitive — not from a field
// name, not from a cookie, not from anything that looks like a token — because a guess replaces
// ordinary output along with the value it was aimed at. A pattern listed in
// `recording.terminal.scrub` replaces only the text it matches, and nothing around it.
//
// One function feeds the panel, the runbook and the console log, because those three have to
// agree: a value covered in the video and printed in full in the runbook next to it is worse than
// not covering it at all — it reads as safe.

const MASK = '•'.repeat(6);

function assertPattern(pattern, index) {
  if (!(pattern instanceof RegExp)) {
    throw new Error(
      `recording.terminal.scrub[${index}] must be a regular expression, got ${typeof pattern}`
    );
  }
  if (pattern.test('')) {
    throw new Error(
      `recording.terminal.scrub[${index}] matches the empty string, which would mask every ` +
      'character of the output. Make the pattern require at least one character.'
    );
  }
}

function createScrub({ patterns = [] } = {}) {
  patterns.forEach(assertPattern);

  // Compiled fresh, and every pattern gets the global flag: a pattern written without it would
  // mask the first occurrence and leave the rest, which is the failure nobody notices.
  const all = patterns.map(
    (p) => new RegExp(p.source, p.flags.includes('g') ? p.flags : `${p.flags}g`)
  );

  return (text) => all.reduce((acc, re) => {
    re.lastIndex = 0;
    return acc.replace(re, MASK);
  }, String(text));
}

module.exports = { createScrub, MASK };
