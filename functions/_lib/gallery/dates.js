const textDecoder = new TextDecoder("ascii");

const pad2 = (value) => String(value).padStart(2, "0");

const isValidDateParts = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const datePartsFromDate = (dateText) => {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !isValidDateParts(match[1], match[2], match[3])) return null;
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    year: match[1],
    month: match[2],
  };
};

const exifDateToParts = (value) => {
  const match = String(value || "").match(/^(\d{4}):(\d{2}):(\d{2})\s+\d{2}:\d{2}:\d{2}/);
  if (!match || !isValidDateParts(match[1], match[2], match[3])) return null;
  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    year: match[1],
    month: match[2],
    source: "exif",
  };
};

export const datePartsFromFilename = (filename = "") => {
  const text = String(filename);
  const compact = text.match(/(?:^|[^\d])((?:20)\d{2})(\d{2})(\d{2})(?:[^\d]|$)/);
  if (compact && isValidDateParts(compact[1], compact[2], compact[3])) {
    return {
      date: `${compact[1]}-${compact[2]}-${compact[3]}`,
      year: compact[1],
      month: compact[2],
      source: "filename",
    };
  }

  const separated = text.match(/((?:20)\d{2})[-_.年\s]?(\d{1,2})[-_.月\s]?(\d{1,2})/);
  if (separated && isValidDateParts(separated[1], separated[2], separated[3])) {
    return {
      date: `${separated[1]}-${pad2(separated[2])}-${pad2(separated[3])}`,
      year: separated[1],
      month: pad2(separated[2]),
      source: "filename",
    };
  }

  return null;
};

const readAscii = (view, start, length) => textDecoder.decode(new Uint8Array(view.buffer, view.byteOffset + start, length)).replace(/\0+$/, "");

const readTiffString = (view, tiffStart, littleEndian, valueOffset, count) => {
  const absolute = count <= 4 ? valueOffset : tiffStart + valueOffset;
  if (absolute < 0 || absolute + count > view.byteLength) return "";
  return readAscii(view, absolute, count);
};

const scanIfd = (view, tiffStart, ifdOffset, littleEndian) => {
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart < 0 || ifdStart + 2 > view.byteLength) return {};
  const entries = view.getUint16(ifdStart, littleEndian);
  const out = {};
  for (let i = 0; i < entries; i += 1) {
    const entry = ifdStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, littleEndian);
    const type = view.getUint16(entry + 2, littleEndian);
    const count = view.getUint32(entry + 4, littleEndian);
    const valueOffset = view.getUint32(entry + 8, littleEndian);
    if (type === 2 && (tag === 0x0132 || tag === 0x9003 || tag === 0x9004)) {
      out[tag] = readTiffString(view, tiffStart, littleEndian, valueOffset, count);
    }
    if (tag === 0x8769) out.exifOffset = valueOffset;
  }
  return out;
};

export const datePartsFromExif = (arrayBuffer) => {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 12 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const segmentLength = view.getUint16(offset + 2, false);
    if (marker === 0xe1 && segmentLength >= 10 && readAscii(view, offset + 4, 6) === "Exif") {
      const tiffStart = offset + 10;
      const endian = readAscii(view, tiffStart, 2);
      const littleEndian = endian === "II";
      if (!littleEndian && endian !== "MM") return null;
      if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;
      const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
      const ifd0 = scanIfd(view, tiffStart, ifd0Offset, littleEndian);
      const exifIfd = ifd0.exifOffset ? scanIfd(view, tiffStart, ifd0.exifOffset, littleEndian) : {};
      return exifDateToParts(exifIfd[0x9003]) || exifDateToParts(exifIfd[0x9004]) || exifDateToParts(ifd0[0x0132]);
    }
    offset += 2 + segmentLength;
  }
  return null;
};

export const detectPhotoDate = (arrayBuffer, filename, fallbackTime) => {
  const fallback = {
    date: fallbackTime.date,
    year: fallbackTime.year,
    month: fallbackTime.month,
    source: "upload",
  };
  return datePartsFromExif(arrayBuffer) || datePartsFromFilename(filename) || fallback;
};
