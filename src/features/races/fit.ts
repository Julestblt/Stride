const fitEpochOffsetSeconds = 631_065_600;
const profileVersion = 2132;
const crcTable = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001,
  0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export const fitBaseTypes = {
  enum: 0x00,
  uint8: 0x02,
  uint16: 0x84,
  sint32: 0x85,
  uint32: 0x86,
  string: 0x07,
  uint32z: 0x8c,
} as const;
type BaseType = keyof typeof fitBaseTypes;
type FieldValue = number | string;
type Field = {
  number: number;
  type: BaseType;
  size?: number;
  value: FieldValue;
};

export const coursePointTypes = {
  generic: 0,
  summit: 1,
  water: 3,
  food: 4,
  danger: 5,
  firstAid: 9,
} as const;

export type FitCoursePoint = {
  elapsedSeconds: number;
  lat: number;
  lon: number;
  distanceM: number;
  type: keyof typeof coursePointTypes;
  name: string;
};

export type FitCourse = {
  name: string;
  startEpochMs: number;
  records: {
    elapsedSeconds: number;
    lat: number;
    lon: number;
    ele: number | null;
    distanceM: number;
  }[];
  points: FitCoursePoint[];
  ascentM: number | null;
  descentM: number | null;
};

export function fitCrc(bytes: Uint8Array, initial = 0) {
  let crc = initial;
  for (const byte of bytes) {
    let tmp = crcTable[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ crcTable[byte & 0xf];
    tmp = crcTable[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ crcTable[(byte >> 4) & 0xf];
  }
  return crc;
}

export function semicircles(degrees: number) {
  return Math.round(degrees * (2 ** 31 / 180));
}

export function fitTimestamp(epochMs: number) {
  return Math.floor(epochMs / 1000) - fitEpochOffsetSeconds;
}

function fieldSize(field: Field) {
  if (field.type === "string") return field.size ?? 16;
  return { enum: 1, uint8: 1, uint16: 2, sint32: 4, uint32: 4, uint32z: 4 }[
    field.type
  ];
}

function encodeString(value: string, size: number) {
  const bytes = new Uint8Array(size);
  const encoded = new TextEncoder().encode(value);
  let length = Math.min(encoded.length, size - 1);
  while (length > 0 && (encoded[length] & 0xc0) === 0x80) length -= 1;
  bytes.set(encoded.subarray(0, length));
  return bytes;
}

class FitWriter {
  private chunks: Uint8Array[] = [];
  private definitions = new Map<string, number>();
  private nextLocal = 0;

  message(global: number, fields: Field[]) {
    const key = `${global}:${fields.map((field) => `${field.number}/${field.type}/${fieldSize(field)}`).join(",")}`;
    let local = this.definitions.get(key);
    if (local === undefined) {
      local = this.nextLocal % 16;
      this.nextLocal += 1;
      for (const [existing, value] of this.definitions)
        if (value === local) this.definitions.delete(existing);
      this.definitions.set(key, local);
      const definition = new Uint8Array(6 + fields.length * 3);
      const view = new DataView(definition.buffer);
      view.setUint8(0, 0x40 | local);
      view.setUint8(2, 0);
      view.setUint16(3, global, true);
      view.setUint8(5, fields.length);
      fields.forEach((field, index) => {
        view.setUint8(6 + index * 3, field.number);
        view.setUint8(7 + index * 3, fieldSize(field));
        view.setUint8(8 + index * 3, fitBaseTypes[field.type]);
      });
      this.chunks.push(definition);
    }
    const size = fields.reduce((sum, field) => sum + fieldSize(field), 1);
    const data = new Uint8Array(size);
    const view = new DataView(data.buffer);
    view.setUint8(0, local);
    let offset = 1;
    for (const field of fields) {
      const value = field.value;
      switch (field.type) {
        case "enum":
        case "uint8":
          view.setUint8(offset, Number(value));
          break;
        case "uint16":
          view.setUint16(offset, Number(value), true);
          break;
        case "sint32":
          view.setInt32(offset, Number(value), true);
          break;
        case "uint32":
        case "uint32z":
          view.setUint32(offset, Number(value), true);
          break;
        case "string":
          data.set(encodeString(String(value), fieldSize(field)), offset);
          break;
      }
      offset += fieldSize(field);
    }
    this.chunks.push(data);
  }

  finish() {
    const length = this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const file = new Uint8Array(14 + length + 2);
    const view = new DataView(file.buffer);
    view.setUint8(0, 14);
    view.setUint8(1, 0x20);
    view.setUint16(2, profileVersion, true);
    view.setUint32(4, length, true);
    file.set(new TextEncoder().encode(".FIT"), 8);
    view.setUint16(12, fitCrc(file.subarray(0, 12)), true);
    let offset = 14;
    for (const chunk of this.chunks) {
      file.set(chunk, offset);
      offset += chunk.length;
    }
    view.setUint16(offset, fitCrc(file.subarray(0, offset)), true);
    return file;
  }
}

function altitude(ele: number | null) {
  return ele === null
    ? 0xffff
    : Math.max(0, Math.min(0xfffe, Math.round((ele + 500) * 5)));
}

export function encodeFitCourse(course: FitCourse) {
  const writer = new FitWriter();
  const start = fitTimestamp(course.startEpochMs);
  const first = course.records[0];
  const last = course.records[course.records.length - 1];
  const end = start + Math.round(last.elapsedSeconds);
  writer.message(0, [
    { number: 0, type: "enum", value: 6 },
    { number: 1, type: "uint16", value: 255 },
    { number: 2, type: "uint16", value: 0 },
    { number: 3, type: "uint32z", value: 1 },
    { number: 4, type: "uint32", value: start },
  ]);
  writer.message(31, [
    { number: 5, type: "string", size: 32, value: course.name },
    { number: 4, type: "enum", value: 1 },
  ]);
  writer.message(19, [
    { number: 253, type: "uint32", value: start },
    { number: 2, type: "uint32", value: start },
    { number: 3, type: "sint32", value: semicircles(first.lat) },
    { number: 4, type: "sint32", value: semicircles(first.lon) },
    { number: 5, type: "sint32", value: semicircles(last.lat) },
    { number: 6, type: "sint32", value: semicircles(last.lon) },
    {
      number: 7,
      type: "uint32",
      value: Math.round(last.elapsedSeconds * 1000),
    },
    {
      number: 8,
      type: "uint32",
      value: Math.round(last.elapsedSeconds * 1000),
    },
    { number: 9, type: "uint32", value: Math.round(last.distanceM * 100) },
    { number: 21, type: "uint16", value: course.ascentM ?? 0xffff },
    { number: 22, type: "uint16", value: course.descentM ?? 0xffff },
  ]);
  writer.message(21, [
    { number: 253, type: "uint32", value: start },
    { number: 0, type: "enum", value: 0 },
    { number: 1, type: "enum", value: 0 },
    { number: 4, type: "uint8", value: 0 },
  ]);
  for (const record of course.records)
    writer.message(20, [
      {
        number: 253,
        type: "uint32",
        value: start + Math.round(record.elapsedSeconds),
      },
      { number: 0, type: "sint32", value: semicircles(record.lat) },
      { number: 1, type: "sint32", value: semicircles(record.lon) },
      { number: 2, type: "uint16", value: altitude(record.ele) },
      { number: 5, type: "uint32", value: Math.round(record.distanceM * 100) },
    ]);
  course.points.forEach((point, index) =>
    writer.message(32, [
      { number: 254, type: "uint16", value: index },
      {
        number: 1,
        type: "uint32",
        value: start + Math.round(point.elapsedSeconds),
      },
      { number: 2, type: "sint32", value: semicircles(point.lat) },
      { number: 3, type: "sint32", value: semicircles(point.lon) },
      { number: 4, type: "uint32", value: Math.round(point.distanceM * 100) },
      { number: 5, type: "enum", value: coursePointTypes[point.type] },
      { number: 6, type: "string", size: 16, value: point.name },
    ]),
  );
  writer.message(21, [
    { number: 253, type: "uint32", value: end },
    { number: 0, type: "enum", value: 0 },
    { number: 1, type: "enum", value: 9 },
    { number: 4, type: "uint8", value: 0 },
  ]);
  return writer.finish();
}
