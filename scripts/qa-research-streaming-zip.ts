import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { inflateRawSync } from 'node:zlib';
import { StreamingZipWriter } from '../src/server/researchStreamingExportRuntime';

class MemorySink extends EventEmitter {
  readonly chunks: Buffer[] = [];
  write(chunk: Buffer | string) {
    this.chunks.push(Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk, 'utf8'));
    return true;
  }
}

async function* chunks(...values: string[]) {
  for (const value of values) yield Buffer.from(value, 'utf8');
}

function readEntries(zip: Buffer): Map<string, Buffer> {
  assert.ok(zip.length >= 22, 'ZIP should contain EOCD');
  const eocdOffset = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocdOffset), 0x06054b50, 'EOCD signature');
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const centralOffset = zip.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, Buffer>();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50, `central signature ${index}`);
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    assert.equal(zip.readUInt32LE(localOffset), 0x04034b50, `local signature ${name}`);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const content = method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed);
    assert.equal(content.length, uncompressedSize, `uncompressed size ${name}`);
    entries.set(name, content);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const sink = new MemorySink();
const writer = new StreamingZipWriter(sink as any);
await writer.addFile('sessions.csv', chunks('\uFEFFsession_id,value\n', 's1,one\n', 's2,two\n'));
await writer.addFile('utterances.csv', chunks('\uFEFFutterance_id,text\n', 'u1,Hello\n'));
await writer.addFile('manifest.json', chunks(JSON.stringify({ row_counts: { sessions: 2, utterances: 1 } })));
await writer.finalize();
const zip = Buffer.concat(sink.chunks);
const entries = readEntries(zip);
assert.deepEqual([...entries.keys()], ['sessions.csv', 'utterances.csv', 'manifest.json']);
assert.equal(entries.get('sessions.csv')?.toString('utf8'), '\uFEFFsession_id,value\ns1,one\ns2,two\n');
assert.equal(entries.get('utterances.csv')?.toString('utf8'), '\uFEFFutterance_id,text\nu1,Hello\n');
assert.deepEqual(JSON.parse(entries.get('manifest.json')!.toString('utf8')), { row_counts: { sessions: 2, utterances: 1 } });
assert.ok(zip.length < Buffer.byteLength([...entries.values()].map((value) => value.toString('binary')).join('')) + 500, 'streaming ZIP should remain compact');
console.log(`Streaming research ZIP compatibility QA: PASS (${zip.length} bytes, ${entries.size} entries)`);
