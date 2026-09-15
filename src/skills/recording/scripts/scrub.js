// Redaction for everything the terminal panel produces.
//
// One function feeds the panel, the runbook and the console log, because those three have to
// agree: a value blacked out in the video and printed in full in the runbook next to it is worse
// than not redacting at all — it reads as safe.
//
// The list is deliberately small. There is no built-in denylist of "things that look like a
// token": one that appears thorough and is not gives the operator a confidence the code cannot
// back. What is covered by default is the one secret this skill introduces itself — the password
// of the account it signs in with — and whatever the project names in its own config.

const MASK = '•'.repeat(6);

// A password is free to contain . * + ? ( ) [ ] and would otherwise compile into a pattern that
// matches far more than itself.
const escapeLiteral = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Below this a "secret" is more likely to be a fragment of ordinary output than a credential,
// and scrubbing it would punch holes through the whole take.
const MIN_SECRET_LENGTH = 4;

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

function createScrub({ secrets = [], patterns = [] } = {}) {
  patterns.forEach(assertPattern);

  const literals = secrets
    .filter((s) => typeof s === 'string' && s.length >= MIN_SECRET_LENGTH)
    .map(escapeLiteral);

  // Compiled fresh, and every pattern gets the global flag: a pattern written without it would
  // mask the first occurrence and leave the rest, which is the failure nobody notices.
  const all = [
    ...literals.map((l) => new RegExp(l, 'g')),
    ...patterns.map((p) => new RegExp(p.source, p.flags.includes('g') ? p.flags : `${p.flags}g`)),
  ];

  return (text) => all.reduce((acc, re) => {
    re.lastIndex = 0;
    return acc.replace(re, MASK);
  }, String(text));
}

module.exports = { createScrub, MASK, MIN_SECRET_LENGTH };
