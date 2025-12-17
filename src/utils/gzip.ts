import { Buffer } from "buffer";

export async function gzip_compress(data: Buffer): Promise<Buffer> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  writer.write(data);
  writer.close();

  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const compressed = Buffer.concat(chunks);
  return compressed;
}

export async function gzip_decompress(compressed: Buffer): Promise<Buffer> {
  const stream = new DecompressionStream("gzip");
  const chunks: Uint8Array[] = [];

  const writer = stream.writable.getWriter();
  writer.write(compressed);
  writer.close();

  const reader = stream.readable.getReader();
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
  }
  reader.releaseLock();

  const data = Buffer.concat(chunks);
  return data;
}
