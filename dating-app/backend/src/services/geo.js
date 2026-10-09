// Privacy-safe geo: round to ~1km cells before storing or querying.
// 0.01 degree ~ 1.1km lat, ~0.7-1km lng depending on latitude. Good enough for MVP.
const CELL = 0.01;

const roundCell = (n) => {
    if (n === null || n === undefined) return null;
    return Math.round(n / CELL) * CELL;
};

const haversineKm = (a, b) => {
    if (a.lat == null || b.lat == null) return null;
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
};

// Bucket distance to keep exact location private even from other users.
const bucketKm = (km) => {
    if (km == null) return null;
    if (km < 2) return '<2km';
    if (km < 5) return '<5km';
    if (km < 10) return '<10km';
    if (km < 25) return '<25km';
    return '25km+';
};

module.exports = { roundCell, haversineKm, bucketKm, CELL };
