/**
 * Landmark pictograms: gold silhouettes in a 24 x 24 box, standing on y = 21, drawn for the game. Each path is filled
 * and stroked on its own, so overlapping pieces keep a thin dark edge (the pyramid pair, the dome over its drum).
 * `evenOdd`: the path has holes (a door, a window). Used by the map (ui/map/landmarks.tsx) and the region sheet
 * (ui/game/LandmarkLine.tsx); content/landmarks.json names one of these as each landmark's `kind`.
 */
export interface LandmarkPath {
  d: string;
  evenOdd?: boolean;
}

export const LANDMARK_ART: Record<string, LandmarkPath[]> = {
  // A domed church on its drum, a lantern on top, low aisles either side (Hagia Sophia, St Peter's, the Duomo,
  // the Dome of the Rock).
  dome: [
    { d: 'M4 21V14H20V21ZM10.5 21V17.6A1.5 1.5 0 0 1 13.5 17.6V21Z', evenOdd: true },
    { d: 'M6.5 14V12.4H17.5V14Z' },
    { d: 'M7.4 12.4A4.6 4.6 0 0 1 16.6 12.4Z' },
    { d: 'M11.6 7.9V5.6H12.4V7.9Z' },
    { d: 'M11.2 5A.8 .8 0 1 0 12.8 5A.8 .8 0 1 0 11.2 5Z' },
    { d: 'M2.5 21V15.5H4V21Z' },
    { d: 'M20 21V15.5H21.5V21Z' },
  ],
  // A twin-towered west front with a rose window and a great door (Notre-Dame).
  cathedral: [
    {
      d: 'M4 21V5.5H8.5V9.5H15.5V5.5H20V21H14V17A2 2 0 0 0 10 17V21ZM10.4 12.6A1.6 1.6 0 1 0 13.6 12.6A1.6 1.6 0 1 0 10.4 12.6ZM5.6 8H6.9V11.5H5.6ZM17.1 8H18.4V11.5H17.1Z',
      evenOdd: true,
    },
    { d: 'M8.5 9.5L12 6.5L15.5 9.5Z' },
  ],
  // A church with one tall spire beside its nave (St Stephen's).
  spire: [
    { d: 'M3 21V13.5H14V21ZM7.4 21V18.2A1.1 1.1 0 0 1 9.6 18.2V21Z', evenOdd: true },
    { d: 'M3 13.5L8.5 10L14 13.5Z' },
    { d: 'M14.5 21V10.5H20V21Z' },
    { d: 'M14.5 10.5L17.25 1.5L20 10.5Z' },
  ],
  // A long arcaded palace with a crenellated keep (Westminster, the Alhambra).
  palace: [
    {
      d: 'M3 21V11H21V21ZM5 21V16.2A1.75 1.75 0 0 1 8.5 16.2V21ZM10.25 21V16.2A1.75 1.75 0 0 1 13.75 16.2V21ZM15.5 21V16.2A1.75 1.75 0 0 1 19 16.2V21Z',
      evenOdd: true,
    },
    { d: 'M3 11V9.4H4.8V11ZM6.4 11V9.4H8.2V11ZM15.8 11V9.4H17.6V11ZM19.2 11V9.4H21V11Z', evenOdd: true },
    { d: 'M9.5 11V5.5H14.5V11Z' },
    { d: 'M9.5 5.5V4H10.8V5.5ZM11.35 5.5V4H12.65V5.5ZM13.2 5.5V4H14.5V5.5Z', evenOdd: true },
  ],
  // A walled citadel with three pointed towers (the Kremlin).
  castle: [
    { d: 'M2 21V12H22V21ZM10 21V16.5A2 2 0 0 1 14 16.5V21Z', evenOdd: true },
    { d: 'M2 12V8H6V12ZM18 12V8H22V12Z', evenOdd: true },
    { d: 'M1.5 8L4 3.5L6.5 8ZM17.5 8L20 3.5L22.5 8Z', evenOdd: true },
    { d: 'M9.5 12V6.5H14.5V12Z' },
    { d: 'M9 6.5L12 1.5L15 6.5Z' },
  ],
  // Two crenellated towers either side of a great arch (the Arsenal's land gate).
  gate: [
    { d: 'M3 21V7H8V21ZM16 21V7H21V21Z', evenOdd: true },
    { d: 'M3 7V5.4H4.6V7ZM6.4 7V5.4H8V7ZM16 7V5.4H17.6V7ZM19.4 7V5.4H21V7Z', evenOdd: true },
    { d: 'M8 21V11.5H16V21H14.4V16.2A2.4 2.4 0 0 0 9.6 16.2V21Z' },
    { d: 'M8 11.5V10H9.6V11.5ZM11.2 11.5V10H12.8V11.5ZM14.4 11.5V10H16V11.5Z', evenOdd: true },
  ],
  // Two pyramids, the nearer the larger.
  pyramid: [{ d: 'M1.5 21L9.5 8L17.5 21Z' }, { d: 'M12.5 21L17 13.5L22.5 21Z' }],
  // A stepped pyramid with a stair up the middle and twin shrines on top (Templo Mayor).
  temple: [
    { d: 'M3 21V18H21V21ZM5 18V15H19V18ZM7 15V12H17V15ZM9 12V9H15V12ZM11.3 21V9H12.7V21Z', evenOdd: true },
    { d: 'M9 9V6H11.5V9ZM12.5 9V6H15V9Z', evenOdd: true },
    { d: 'M8.6 6L10.25 4L11.9 6ZM12.1 6L13.75 4L15.4 6Z', evenOdd: true },
  ],
  // A mosque of earth: a tapering tower with timber ends sticking out, low walls with corner pinnacles
  // (Djinguereber).
  mudmosque: [
    { d: 'M3 21V13H21V21ZM10.5 21V17.5A1.5 1.5 0 0 1 13.5 17.5V21Z', evenOdd: true },
    { d: 'M8.8 13L9.8 3.5H14.2L15.2 13Z' },
    { d: 'M8 6.4H9.6V7H8ZM14.4 6.4H16V7H14.4ZM7.8 9.6H9.3V10.2H7.8ZM14.7 9.6H16.2V10.2H14.7Z', evenOdd: true },
    { d: 'M3 13L3.6 10.2H4.6L5.2 13ZM18.8 13L19.4 10.2H20.4L21 13Z', evenOdd: true },
    { d: 'M9.5 3.5L10.3 2.5H13.7L14.5 3.5Z' },
  ],
  // A bridge of stone arches with its gate tower (Charles Bridge).
  bridge: [
    { d: 'M1 13.2H23V15H1Z' },
    {
      d: 'M1 15H23V21H20.6V19.3A2.6 2.6 0 0 0 15.4 19.3V21H14.6V19.3A2.6 2.6 0 0 0 9.4 19.3V21H8.6V19.3A2.6 2.6 0 0 0 3.4 19.3V21H1Z',
    },
    { d: 'M2 13.2V6H7V13.2ZM3.6 13.2V10.4A.9 .9 0 0 1 5.4 10.4V13.2Z', evenOdd: true },
    { d: 'M1.5 6L4.5 1.8L7.5 6Z' },
  ],
  // A tall square bell tower with a small lantern, low walls at its foot (the Giralda).
  tower: [
    { d: 'M9 21V7.5H15V21ZM11 9.5H13V12H11ZM11 14H13V16.5H11Z', evenOdd: true },
    { d: 'M9.8 7.5V4.5H14.2V7.5Z' },
    { d: 'M10.4 4.5L12 1.2L13.6 4.5Z' },
    { d: 'M4.5 21V17.5H9V21ZM15 21V17.5H19.5V21Z', evenOdd: true },
  ],
};
