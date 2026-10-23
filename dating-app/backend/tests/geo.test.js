const { roundCell, haversineKm, bucketKm, CELL } = require('../src/services/geo');

describe('geo.roundCell', () => {
    test('null passes through', () => {
        expect(roundCell(null)).toBeNull();
        expect(roundCell(undefined)).toBeNull();
    });
    test('rounds to CELL grid', () => {
        expect(roundCell(37.7749)).toBeCloseTo(37.77, 5);
        expect(roundCell(37.7799)).toBeCloseTo(37.78, 5);
    });
    test('is idempotent', () => {
        const r = roundCell(-122.4194);
        expect(roundCell(r)).toBeCloseTo(r, 6);
    });
});

describe('geo.haversineKm', () => {
    test('null-safe', () => {
        expect(haversineKm({ lat: null }, { lat: 1, lng: 2 })).toBeNull();
    });
    test('SF -> LA ~ 559km', () => {
        const km = haversineKm(
            { lat: 37.7749, lng: -122.4194 },
            { lat: 34.0522, lng: -118.2437 }
        );
        expect(km).toBeGreaterThan(540);
        expect(km).toBeLessThan(580);
    });
});

describe('geo.bucketKm', () => {
    test('null passes through', () => expect(bucketKm(null)).toBeNull());
    test('picks the smallest matching bucket', () => {
        expect(bucketKm(0.5)).toBe('<2km');
        expect(bucketKm(3)).toBe('<5km');
        expect(bucketKm(9.9)).toBe('<10km');
        expect(bucketKm(20)).toBe('<25km');
        expect(bucketKm(100)).toBe('25km+');
    });
});
