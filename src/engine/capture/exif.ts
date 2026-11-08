/**
 * Minimal JPEG EXIF reader. Reads only what the capture analysis needs: the focal
 * length (and its 35 mm equivalent) and the "Software" tag (editing hint). GPS,
 * camera make/model, dates and every other tag are deliberately not read.
 */
export interface ExifInfo {
  focalLengthMm?: number;
  focalLength35mm?: number;
  software?: string;
}

const TAG_SOFTWARE = 0x0131;
const TAG_EXIF_IFD = 0x8769;
const TAG_FOCAL_LENGTH = 0x920a;
const TAG_FOCAL_35 = 0xa405;

export function parseExif(input: ArrayBuffer | Uint8Array): ExifInfo | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG
  let off = 2;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) return null;
    const marker = bytes[off + 1];
    if (marker === 0xda || marker === 0xd9) return null; // start of scan / end: no APP1 found
    const len = view.getUint16(off + 2);
    if (marker === 0xe1 && off + 10 <= bytes.length && view.getUint32(off + 4) === 0x45786966 /* "Exif" */) {
      return readTiff(view, off + 10, Math.min(bytes.length, off + 2 + len));
    }
    off += 2 + len;
  }
  return null;
}

function readTiff(view: DataView, start: number, end: number): ExifInfo | null {
  if (start + 8 > end) return null;
  const order = view.getUint16(start);
  const le = order === 0x4949;
  if (!le && order !== 0x4d4d) return null;
  const u16 = (o: number) => view.getUint16(start + o, le);
  const u32 = (o: number) => view.getUint32(start + o, le);
  if (u16(2) !== 42) return null;
  const info: ExifInfo = {};
  const inRange = (o: number, n: number) => start + o >= start && start + o + n <= end;

  const readIfd = (ifdOff: number, onTag: (tag: number, type: number, count: number, valueOff: number) => void) => {
    if (!inRange(ifdOff, 2)) return;
    const n = u16(ifdOff);
    for (let i = 0; i < n; i++) {
      const e = ifdOff + 2 + i * 12;
      if (!inRange(e, 12)) return;
      onTag(u16(e), u16(e + 2), u32(e + 4), e + 8);
    }
  };
  const rational = (valueOff: number) => {
    const p = u32(valueOff);
    if (!inRange(p, 8)) return undefined;
    const den = u32(p + 4);
    return den ? u32(p) / den : undefined;
  };
  const ascii = (count: number, valueOff: number) => {
    const p = count > 4 ? u32(valueOff) : valueOff;
    if (!inRange(p, count)) return undefined;
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = view.getUint8(start + p + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s.trim().slice(0, 80) || undefined;
  };

  let exifIfd = 0;
  readIfd(u32(4), (tag, _type, count, valueOff) => {
    if (tag === TAG_SOFTWARE) info.software = ascii(count, valueOff);
    if (tag === TAG_EXIF_IFD) exifIfd = u32(valueOff);
  });
  if (exifIfd) {
    readIfd(exifIfd, (tag, _type, _count, valueOff) => {
      if (tag === TAG_FOCAL_LENGTH) info.focalLengthMm = rational(valueOff);
      if (tag === TAG_FOCAL_35) {
        const v = u16(valueOff);
        if (v > 0) info.focalLength35mm = v;
      }
    });
  }
  return info;
}
