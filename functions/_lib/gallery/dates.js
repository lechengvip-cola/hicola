const textDecoder = new TextDecoder("ascii");
const latinDecoder = new TextDecoder("latin1");
const quickTimeEpochOffset = 2082844800;

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

const datePartsFromDateObject = (date, source) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = String(date.getUTCFullYear());
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  if (!isValidDateParts(year, month, day)) return null;
  return {
    date: `${year}-${month}-${day}`,
    year,
    month,
    source,
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

const datePartsFromEmbeddedText = (arrayBuffer) => {
  const sampleSize = Math.min(arrayBuffer.byteLength, 2 * 1024 * 1024);
  const text = latinDecoder.decode(new Uint8Array(arrayBuffer, 0, sampleSize));
  const iso = text.match(/((?:20)\d{2})[-:](\d{2})[-:](\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (iso && isValidDateParts(iso[1], iso[2], iso[3])) {
    return {
      date: `${iso[1]}-${iso[2]}-${iso[3]}`,
      year: iso[1],
      month: iso[2],
      source: "video-metadata",
    };
  }

  const compact = text.match(/(?:creationdate|date|time)[\s\S]{0,80}?((?:20)\d{2})(\d{2})(\d{2})/i);
  if (compact && isValidDateParts(compact[1], compact[2], compact[3])) {
    return {
      date: `${compact[1]}-${compact[2]}-${compact[3]}`,
      year: compact[1],
      month: compact[2],
      source: "video-metadata",
    };
  }

  return null;
};

const readUint64 = (view, offset) => {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 2 ** 32 + low;
};

const datePartsFromMp4Seconds = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= quickTimeEpochOffset) return null;
  return datePartsFromDateObject(new Date((seconds - quickTimeEpochOffset) * 1000), "video-metadata");
};

const scanMp4Boxes = (view, start, end, depth = 0) => {
  if (depth > 6) return null;
  let offset = start;
  while (offset + 8 <= end && offset + 8 <= view.byteLength) {
    let size = view.getUint32(offset);
    const type = readAscii(view, offset + 4, 4);
    let header = 8;
    if (size === 1 && offset + 16 <= view.byteLength) {
      size = readUint64(view, offset + 8);
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (!size || size < header || offset + size > end || offset + size > view.byteLength) break;

    if (type === "mvhd" && offset + header + 16 <= view.byteLength) {
      const version = view.getUint8(offset + header);
      const creationOffset = offset + header + 4;
      const seconds = version === 1 && creationOffset + 8 <= view.byteLength ? readUint64(view, creationOffset) : view.getUint32(creationOffset);
      const parsed = datePartsFromMp4Seconds(seconds);
      if (parsed) return parsed;
    }

    if (["moov", "trak", "mdia", "minf", "stbl", "udta", "meta", "ilst"].includes(type)) {
      const childStart = type === "meta" ? offset + header + 4 : offset + header;
      const parsed = scanMp4Boxes(view, childStart, offset + size, depth + 1);
      if (parsed) return parsed;
    }

    offset += size;
  }
  return null;
};

export const datePartsFromVideoMetadata = (arrayBuffer) => {
  if (!arrayBuffer || arrayBuffer.byteLength < 16) return null;
  const embedded = datePartsFromEmbeddedText(arrayBuffer);
  if (embedded) return embedded;
  return scanMp4Boxes(new DataView(arrayBuffer), 0, arrayBuffer.byteLength);
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
  return datePartsFromExif(arrayBuffer) || datePartsFromVideoMetadata(arrayBuffer) || datePartsFromFilename(filename) || fallback;
};
