// Mercator projection of the playable window onto the province raster.
// World units equal raster pixels; x grows east, z grows south.
export const LON0 = -11, LON1 = 50, LAT0 = 27, LAT1 = 64;
export const W = 1280;
const R = Math.PI / 180;
const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2));
export const SCALE = W / ((LON1 - LON0) * R);
const MY1 = my(LAT1);
export const H = Math.round((MY1 - my(LAT0)) * SCALE);

export const toXY = (lon, lat) => [(lon - LON0) * R * SCALE, (MY1 - my(lat)) * SCALE];
export const toLonLat = (x, y) => [LON0 + x / SCALE / R, (2 * Math.atan(Math.exp(MY1 - y / SCALE)) - Math.PI / 2) / R];
// Kilometres covered by one pixel at a given raster row.
export const kmPerPx = (y) => (111.32 * Math.cos(toLonLat(0, y)[1] * R)) / (SCALE * R);
