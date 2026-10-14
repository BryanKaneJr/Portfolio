/**
 * Landmark pictograms, one per landmark (its `kind` in content/landmarks.json is its id): simple gold silhouettes in a
 * 24 x 24 box, standing on y = 21, each the outline a player would know the place by. Each path is filled and stroked
 * on its own, so overlapping pieces keep a thin dark edge (the ribs of a dome, the faces of a pyramid). `evenOdd`: the
 * path has holes (a door, a window). Parts are kept to about 1.2 box units or more, holes and the gaps between
 * pieces to about 1.4 (or the pieces touch), so they hold at map size. Used by the map (ui/map/landmarks.tsx) and the region sheet (ui/game/LandmarkLine.tsx).
 */
export interface LandmarkPath {
  d: string;
  evenOdd?: boolean;
}

export const LANDMARK_ART: Record<string, LandmarkPath[]> = {
  // Hagia Sophia: a broad low block, half-domes stepping down either side of the great shallow dome on its band of
  // windows, a minaret pair at each end (the outer pair taller).
  hagia_sophia: [
    { d: 'M4.6 21V16.6H19.4V21ZM10.8 21V18.8A1.2 1.2 0 0 1 13.2 18.8V21Z', evenOdd: true },
    { d: 'M5.2 16.6A3.8 2.8 0 0 1 9 13.8V16.6ZM18.8 16.6A3.8 2.8 0 0 0 15 13.8V16.6Z' },
    { d: 'M8 13.8V12.4H16V13.8Z' },
    { d: 'M7.2 12.4A4.8 3.4 0 0 1 16.8 12.4Z' },
    { d: 'M0.6 21V8.4H2.4V21ZM21.6 21V8.4H23.4V21ZM0.6 8.4L1.5 3.2L2.4 8.4ZM21.6 8.4L22.5 3.2L23.4 8.4Z' },
    { d: 'M3.8 21V10.4H5.6V21ZM18.4 21V10.4H20.2V21ZM3.8 10.4L4.7 6.6L5.6 10.4ZM18.4 10.4L19.3 6.6L20.2 10.4Z' },
  ],
  // St Peter's: a tall ribbed dome on its drum, lantern on top, over a wide columned front with a cupola at each end.
  st_peters: [
    {
      d: 'M2 21V15H22V21ZM3.8 21V16.8H5.4V21ZM6.9 21V16.8H8.5V21ZM15.5 21V16.8H17.1V21ZM18.6 21V16.8H20.2V21ZM10.6 21V18A1.4 1.4 0 0 1 13.4 18V21Z',
      evenOdd: true,
    },
    { d: 'M2.8 15A1.8 1.8 0 0 1 6.4 15ZM17.6 15A1.8 1.8 0 0 1 21.2 15Z' },
    { d: 'M8.2 15V10.4H15.8V15Z' },
    { d: 'M7.9 10.4C7.9 6.8 9.2 5.3 12 4.7C10.8 6 10.5 8.2 10.5 10.4Z' },
    { d: 'M10.5 10.4C10.5 8.2 10.8 6 12 4.7C13.2 6 13.5 8.2 13.5 10.4Z' },
    { d: 'M13.5 10.4C13.5 8.2 13.2 6 12 4.7C14.8 5.3 16.1 6.8 16.1 10.4Z' },
    { d: 'M11.2 5V3H12.8V5ZM11.2 3L12 1.2L12.8 3Z' },
  ],
  // The Duomo: Brunelleschi's pointed ribbed dome and lantern over the nave, Giotto's square bell tower beside it.
  duomo: [
    { d: 'M1.5 21V5.4H0.9V4.2H6.3V5.4H5.7V21ZM2.9 6.6H4.3V10.2H2.9Z', evenOdd: true },
    { d: 'M8 21V15.4H22.5V21Z' },
    { d: 'M10.4 15.4V11.8H20.6V15.4Z' },
    { d: 'M10.8 11.8C10.8 8.2 13 5.8 15.5 4.6C14.2 6.4 13.7 9 13.7 11.8Z' },
    { d: 'M13.7 11.8C13.7 9 14.2 6.4 15.5 4.6C16.8 6.4 17.3 9 17.3 11.8Z' },
    { d: 'M17.3 11.8C17.3 9 16.8 6.4 15.5 4.6C18 5.8 20.2 8.2 20.2 11.8Z' },
    { d: 'M14.7 4.9V2.9H16.3V4.9ZM14.7 2.9L15.5 1.2L16.3 2.9Z' },
  ],
  // The Dome of the Rock: a high round dome flush on its drum over a low octagon, three arches on its face.
  dome_of_rock: [
    { d: 'M0.8 21V16.2L6.6 15V21Z' },
    { d: 'M17.4 21V15L23.2 16.2V21Z' },
    {
      d: 'M6.6 21V15H17.4V21ZM8.2 19.8V17.6A0.8 0.8 0 0 1 9.8 17.6V19.8ZM11.2 19.8V17.6A0.8 0.8 0 0 1 12.8 17.6V19.8ZM14.2 19.8V17.6A0.8 0.8 0 0 1 15.8 17.6V19.8Z',
      evenOdd: true,
    },
    { d: 'M7.2 15V11.6H16.8V15Z' },
    { d: 'M7.2 11.6C7.2 7 9.4 4.8 12 4.4C14.6 4.8 16.8 7 16.8 11.6Z' },
    { d: 'M11.4 4.6V2H12.6V4.6Z' },
  ],
  // Notre-Dame: twin flat-topped towers, the rose window and portal between them, the old spire behind.
  notre_dame: [
    { d: 'M11.2 9.8L12 3.8L12.8 9.8Z' },
    {
      d: 'M8.6 21V9.8H15.4V21H13.3V18.6A1.3 1.3 0 0 0 10.7 18.6V21ZM10.1 13.6A1.9 1.9 0 1 0 13.9 13.6A1.9 1.9 0 1 0 10.1 13.6Z',
      evenOdd: true,
    },
    { d: 'M3.2 21V3.4H8.6V21ZM5.1 11V7.2A.8 .8 0 0 1 6.7 7.2V11Z', evenOdd: true },
    { d: 'M15.4 21V3.4H20.8V21ZM17.3 11V7.2A.8 .8 0 0 1 18.9 7.2V11Z', evenOdd: true },
  ],
  // St Stephen's: the steep roof with its zigzag tiles beside the one very tall tapering spire.
  st_stephens: [
    { d: 'M1.6 21V15.6H15.4V21Z' },
    {
      d: 'M1.2 15.6L4.4 7.4H11.6L14.8 15.6ZM3.8 12L6 9.8L8 11.8L10 9.8L12.2 12V14L10 11.8L8 13.8L6 11.8L3.8 14Z',
      evenOdd: true,
    },
    { d: 'M15.2 21L15.6 12.4L16.4 10.6L18.1 0.6L19.8 10.6L20.6 12.4L21 21Z' },
  ],
  // Westminster: a pointed Gothic gable with its tall west window, a pinnacled turret at each corner.
  westminster: [
    { d: 'M6.6 21V11.2L12 5L17.4 11.2V21ZM10.2 18.8V12.6L12 9.4L13.8 12.6V18.8Z', evenOdd: true },
    { d: 'M2.8 21V9H6.6V21ZM2.4 9V7.8H7V9ZM3 7.8L4.7 4.4L6.4 7.8Z' },
    { d: 'M17.4 21V9H21.2V21ZM17 9V7.8H21.6V9ZM17.6 7.8L19.3 4.4L21 7.8Z' },
  ],
  // The Alhambra: a long battlemented wall on its hill, a horseshoe gate, the tall Comares tower and a small one.
  alhambra: [
    {
      d: 'M2 20.6V10.2H4.2V11.8H6.4V10.2H8.7V11.8H10.9V10.2H13.1V11.8H15.3V10.2H17.6V11.8H19.8V10.2H22V20.6ZM8.6 18V14.6A1.5 1.5 0 1 1 11.2 14.6V18Z',
      evenOdd: true,
    },
    { d: 'M12.2 11.8V2.9H14.3V4.5H16.5V2.9H18.6V11.8Z' },
    { d: 'M3 11.8V7.2H4.6V8.7H6.2V7.2H7.8V11.8Z' },
    { d: 'M0.4 21C3 15.6 21 15.6 23.6 21Z' },
  ],
  // The Kremlin: its wall with the tall tent-roofed gate tower, tented corner towers, onion domes behind.
  kremlin: [
    { d: 'M0.6 21V14H23.4V21Z' },
    {
      d: 'M5.7 14V12.8H6.9V14ZM6.3 9.4C6.6 10.4 7.5 10.8 7.5 11.8C7.5 12.6 7.2 12.8 6.3 12.8C5.4 12.8 5.1 12.6 5.1 11.8C5.1 10.8 6 10.4 6.3 9.4ZM17.1 14V12.8H18.3V14ZM17.7 9.4C18 10.4 18.9 10.8 18.9 11.8C18.9 12.6 18.6 12.8 17.7 12.8C16.8 12.8 16.5 12.6 16.5 11.8C16.5 10.8 17.4 10.4 17.7 9.4Z',
    },
    { d: 'M0.8 14V9.6H3.4V14ZM20.6 14V9.6H23.2V14Z' },
    { d: 'M0.6 9.6L2.1 5L3.6 9.6ZM20.4 9.6L21.9 5L23.4 9.6Z' },
    { d: 'M9 21V9.4H15V21ZM10.6 21V17.4A1.4 1.4 0 0 1 13.4 17.4V21Z', evenOdd: true },
    { d: 'M8.6 9.4V7.8H15.4V9.4ZM9.8 7.8V5.6H14.2V7.8Z', evenOdd: true },
    { d: 'M9.8 5.6L12 0.6L14.2 5.6Z' },
  ],
  // The Arsenal: the twin battlemented towers of the water gate, a footbridge between them, the canal at their feet.
  arsenal: [
    { d: 'M7.5 11.4H16.5V14.8Q12 12.4 7.5 14.8Z' },
    {
      d: 'M3 20V8H8V20ZM16 20V8H21V20ZM4.8 13.4V10.8A0.7 0.7 0 0 1 6.2 10.8V13.4ZM17.8 13.4V10.8A0.7 0.7 0 0 1 19.2 10.8V13.4Z',
      evenOdd: true,
    },
    { d: 'M2.4 8V6.4H8.6V8ZM15.4 8V6.4H21.6V8Z', evenOdd: true },
    { d: 'M2.4 6.4V4.4H4.4V6.4ZM6.6 6.4V4.4H8.6V6.4ZM15.4 6.4V4.4H17.4V6.4ZM19.6 6.4V4.4H21.6V6.4Z', evenOdd: true },
    { d: 'M1.6 21V18.8Q6.8 17.6 12 18.8Q17.2 20 22.4 18.8V21Z' },
  ],
  // The Pyramids: three, the great one behind the two smaller, each face a piece of its own so an edge runs down the ridge.
  pyramids: [
    { d: 'M0.8 21L10 8.4L12.8 21Z' },
    { d: 'M10 8.4L19.2 21H12.8Z' },
    { d: 'M12.6 21L18 13.6L19.6 21Z' },
    { d: 'M18 13.6L23.4 21H19.6Z' },
    { d: 'M0.4 21L4 16.2L5 21ZM4 16.2L7.6 21H5Z', evenOdd: true },
  ],
  // Templo Mayor: four stepped tiers, a stair up to each of the twin shrines on top.
  templo_mayor: [
    { d: 'M2 21V18.5H22V21ZM3.8 18.5V16H20.2V18.5ZM5.6 16V13.5H18.4V16ZM7.4 13.5V11H16.6V13.5Z', evenOdd: true },
    { d: 'M8.2 21L8.7 11H10.7L11.2 21ZM12.8 21L13.3 11H15.3L15.8 21Z' },
    { d: 'M8 11V7.2H11.2V11ZM12.8 11V7.2H16V11Z', evenOdd: true },
    { d: 'M7.8 7.2L8.5 4.2H10.7L11.4 7.2ZM12.6 7.2L13.3 4.2H15.5L16.2 7.2Z', evenOdd: true },
  ],
  // Djinguereber: an earthen mosque, rounded pinnacles on its walls, a tapering tower with timbers sticking out.
  djinguereber: [
    { d: 'M2 21L2.6 14H21.4L22 21ZM10.6 21V17.8A1.4 1.4 0 0 1 13.4 17.8V21Z', evenOdd: true },
    {
      d: 'M2.4 14V12.2Q3.2 10.8 4 12.2V14ZM5.2 14V12.2Q6 10.8 6.8 12.2V14ZM17.2 14V12.2Q18 10.8 18.8 12.2V14ZM20 14V12.2Q20.8 10.8 21.6 12.2V14Z',
      evenOdd: true,
    },
    {
      d: 'M8.1 5H11V6.2H8.1ZM13 5H15.9V6.2H13ZM7.4 7.6H10.6V8.8H7.4ZM13.4 7.6H16.6V8.8H13.4ZM7.8 10.2H10V11.4H7.8ZM14 10.2H16.2V11.4H14Z',
      evenOdd: true,
    },
    { d: 'M8.4 14L10.2 3.8H13.8L15.6 14Z' },
    { d: 'M10.6 3.8V2.6Q12 0.6 13.4 2.6V3.8Z' },
  ],
  // Charles Bridge: a deck on three stone arches and the gate tower at its end.
  charles_bridge: [
    { d: 'M7 12.8H23V15H7Z' },
    {
      d: 'M1 15H23V21H21V19.4A2.333 2.333 0 0 0 16.333 19.4V21H14.333V19.4A2.333 2.333 0 0 0 9.667 19.4V21H7.667V19.4A2.333 2.333 0 0 0 3 19.4V21H1Z',
    },
    { d: 'M1.6 15V5.4H7.4V15ZM3.4 15V12A1.1 1.1 0 0 1 5.6 12V15Z', evenOdd: true },
    { d: 'M.8 5.4L4.5 1L8.2 5.4Z' },
  ],
  // The Giralda: the slim square tower with its lozenge panels, belfry, lantern and figure, low cathedral roofs at its foot.
  giralda: [
    { d: 'M1.6 21V16.6L4.6 15.2H8.8V21ZM15.2 21V15.2H19.4L22.4 16.6V21Z' },
    {
      d: 'M8.8 21V9.2H15.2V21ZM12 11.2L13.2 12.9L12 14.6L10.8 12.9ZM12 15.8L13.2 17.5L12 19.2L10.8 17.5Z',
      evenOdd: true,
    },
    { d: 'M9.6 9.2V5.2H14.4V9.2ZM11.3 8V7.3A0.7 0.7 0 0 1 12.7 7.3V8Z', evenOdd: true },
    { d: 'M10.3 5.2V3.2H13.7V5.2Z' },
    { d: 'M10.7 3.2A1.3 1.6 0 0 1 13.3 3.2ZM11.4 1.8V.3H12.6V1.8Z' },
  ],
};
