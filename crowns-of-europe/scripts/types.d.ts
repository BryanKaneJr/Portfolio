declare module 'polylabel' {
  const polylabel: (polygon: number[][][], precision?: number) => number[] & { distance: number };
  export default polylabel;
}
declare module 'pngjs' {
  export class PNG {
    constructor(opts: { width: number; height: number; colorType?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: { read(buf: Buffer): PNG; write(png: PNG, opts?: { colorType?: number }): Buffer };
  }
}
