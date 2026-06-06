import { test } from 'node:test';
import assert from 'node:assert/strict';
import { num, int, str, arr, bool, date } from '../src/normalize.ts';

test('num: handles empty, NaN, strings', () => {
  assert.equal(num(''), null);
  assert.equal(num(null), null);
  assert.equal(num('abc'), null);
  assert.equal(num('12.5'), 12.5);
  assert.equal(num('1,200'), 1200);
  assert.equal(num(36.5), 36.5);
  assert.equal(num(NaN), null);
});

test('int: truncates', () => {
  assert.equal(int('70.9'), 70);
  assert.equal(int(''), null);
});

test('str: trims and nullifies empty', () => {
  assert.equal(str('  hi '), 'hi');
  assert.equal(str(''), null);
  assert.equal(str('   '), null);
  assert.equal(str(0), '0');
});

test('arr: normalizes to string[]', () => {
  assert.deepEqual(arr(['a', 'b']), ['a', 'b']);
  assert.deepEqual(arr('x'), ['x']);
  assert.deepEqual(arr(''), []);
  assert.deepEqual(arr(null), []);
  assert.deepEqual(arr(['a', '', ' c ']), ['a', 'c']);
});

test('bool', () => {
  assert.equal(bool(true), true);
  assert.equal(bool('true'), true);
  assert.equal(bool(1), true);
  assert.equal(bool('false'), false);
  assert.equal(bool(undefined), false);
});

test('date: normalizes to YYYY-MM-DD', () => {
  assert.equal(date('2026-01-10'), '2026-01-10');
  assert.equal(date('2026/1/5'), '2026-01-05');
  assert.equal(date('bad-date'), null);
  assert.equal(date(''), null);
});
