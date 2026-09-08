// Captions are the only thing standing in for widgets the recording cannot contain, so the
// contract worth locking is: every locale answers every caption key, an unknown locale fails
// loudly, and a disabled caption set returns null rather than an empty overlay.
const test = require('node:test');
const assert = require('node:assert/strict');

const { LOCALES, LOCALE_KEYS, assertLocale, createCaptions } = require('../src/skills/recording/scripts/captions');

const CAPTION_KEYS = ['selectOption', 'uploadFile'];

test('every locale supplies every caption key', () => {
  for (const locale of LOCALE_KEYS) {
    assert.equal(typeof LOCALES[locale].label, 'string', locale);
    for (const key of CAPTION_KEYS) {
      assert.equal(typeof LOCALES[locale][key], 'function', `${locale}.${key}`);
    }
  }
});

test('assertLocale returns supported locales and rejects the rest', () => {
  for (const locale of LOCALE_KEYS) assert.equal(assertLocale(locale, 'test'), locale);
  assert.throws(() => assertLocale('fr', 'test'), /fr/);
  assert.throws(() => assertLocale(undefined, 'test'));
});

test('an enabled caption set renders the value it was given', () => {
  for (const locale of LOCALE_KEYS) {
    const captions = createCaptions({ enabled: true, locale });
    const text = captions.text('selectOption', { value: 'Active' });
    assert.ok(text.includes('Active'), `${locale}: ${text}`);
    assert.ok(captions.text('uploadFile', { file: 'sample.csv' }).includes('sample.csv'), locale);
  }
});

test('a disabled caption set returns null so the runner draws nothing', () => {
  const captions = createCaptions({ enabled: false, locale: 'en' });
  assert.equal(captions.enabled, false);
  assert.equal(captions.text('selectOption', { value: 'Active' }), null);
});

test('an unknown caption key fails instead of rendering "undefined"', () => {
  const captions = createCaptions({ enabled: true, locale: 'en' });
  assert.throws(() => captions.text('nonexistent', {}), /nonexistent/);
});

test('createCaptions rejects an unsupported locale', () => {
  assert.throws(() => createCaptions({ enabled: true, locale: 'fr' }), /fr/);
});
