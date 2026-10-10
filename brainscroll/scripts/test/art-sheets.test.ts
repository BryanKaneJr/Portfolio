import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSheets, type SheetLayout } from '../lib/art-sheets';

/** Level art sheets (lib/art-sheets.ts): placement sticks, so adding art never changes a sheet phones already have. */
const same = () => 'h';
const ids = (l: SheetLayout) => l.sheets.map((s) => s.ids);

test('new images fill sheets of four in order of first use, then by name', () => {
  const l = planSheets(null, ['e', 'd', 'c', 'b', 'a'], ['c', 'a'], same);
  assert.deepEqual(ids(l), [
    ['c', 'a', 'b', 'd'],
    ['e', null, null, null],
  ]);
});

test('an image keeps its cell; a removed one leaves a gap the next new one fills', () => {
  const first = planSheets(null, ['a', 'b', 'c', 'd', 'e'], [], same);
  const next = planSheets(first, ['a', 'c', 'd', 'e', 'f', 'g'], [], same);
  assert.deepEqual(ids(next), [
    ['a', 'f', 'c', 'd'],
    ['e', 'g', null, null],
  ]);
  // Untouched sheets keep their hash, so their file stays as it is.
  const more = planSheets(next, ['a', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'], [], same);
  assert.equal(more.sheets[0]!.hash, next.sheets[0]!.hash);
  assert.notEqual(more.sheets[1]!.hash, next.sheets[1]!.hash);
});

test('a sheet with nothing left goes; one changed image changes only its sheet', () => {
  const first = planSheets(null, ['a', 'b', 'c', 'd', 'e', 'f'], [], same);
  assert.deepEqual(ids(planSheets(first, ['e', 'f'], [], same)), [['e', 'f', null, null]]);
  const edited = planSheets(first, ['a', 'b', 'c', 'd', 'e', 'f'], [], (id) => (id === 'e' ? 'new' : 'h'));
  assert.equal(edited.sheets[0]!.hash, first.sheets[0]!.hash);
  assert.notEqual(edited.sheets[1]!.hash, first.sheets[1]!.hash);
});
