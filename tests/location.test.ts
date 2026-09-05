import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoogleMapsUrl,
  normalizePinnedLocation,
  parseCoordinateInput,
} from '../src/lib/location.ts';

test('normalizes valid coordinates, precision, and an optional label', () => {
  assert.deepEqual(normalizePinnedLocation({
    latitude: 25.033963123,
    longitude: 121.564468999,
    label: '  Taipei 101  ',
  }), {
    latitude: 25.033963,
    longitude: 121.564469,
    label: 'Taipei 101',
  });
});

test('accepts coordinate boundaries and omits an empty label', () => {
  assert.deepEqual(normalizePinnedLocation({ latitude: -90, longitude: 180, label: '  ' }), {
    latitude: -90,
    longitude: 180,
  });
});

test('rejects missing, non-finite, and out-of-range coordinates', () => {
  assert.equal(normalizePinnedLocation(null), null);
  assert.equal(normalizePinnedLocation({ latitude: 0 }), null);
  assert.equal(normalizePinnedLocation({ latitude: Number.NaN, longitude: 0 }), null);
  assert.equal(normalizePinnedLocation({ latitude: 90.000001, longitude: 0 }), null);
  assert.equal(normalizePinnedLocation({ latitude: 0, longitude: -180.000001 }), null);
});

test('does not coerce blank coordinate inputs to zero', () => {
  assert.equal(parseCoordinateInput(''), null);
  assert.equal(parseCoordinateInput('   '), null);
  assert.equal(parseCoordinateInput('not-a-number'), null);
  assert.equal(parseCoordinateInput('0'), 0);
});

test('builds a bounded Google Maps URL from coordinates only', () => {
  assert.equal(
    buildGoogleMapsUrl({ latitude: 25.033963, longitude: 121.564469, label: 'Ignored in URL' }),
    'https://www.google.com/maps/search/?api=1&query=25.033963%2C121.564469'
  );
});
