import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectSourceKind } from '../src/detect.ts';

function fx(name: string): unknown {
  const p = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));
  return JSON.parse(readFileSync(p, 'utf-8'));
}

test('detect gyneco_full', () => {
  assert.equal(detectSourceKind(fx('gyneco_full')), 'gyneco_full');
});

test('detect athlete_full', () => {
  assert.equal(detectSourceKind(fx('athlete_full')), 'athlete_full');
});

test('detect karte_state', () => {
  assert.equal(detectSourceKind(fx('karte_state')), 'karte_state');
});

test('detect gyneco_summary', () => {
  assert.equal(detectSourceKind(fx('gyneco_summary')), 'gyneco_summary');
});

test('detect unknown for non-object', () => {
  assert.equal(detectSourceKind(null), 'unknown');
  assert.equal(detectSourceKind([1, 2, 3]), 'unknown');
  assert.equal(detectSourceKind({ foo: 'bar' }), 'unknown');
});

test('athlete takes precedence (records + trainings)', () => {
  // records も trainings もあるケースは athlete と判定
  assert.equal(detectSourceKind({ records: {}, trainings: [] }), 'athlete_full');
});
