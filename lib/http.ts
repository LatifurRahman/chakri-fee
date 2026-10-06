import "server-only";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
// Bound UTF-8 bytes while streaming; do not buffer an arbitrarily large request first.
export async function readJson(
  request: Request,
  limit: number,
): Promise<Record<string, unknown>> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit)
    throw new HttpError(413, "তথ্য অনেক বড়।");
  if (!request.body) throw new HttpError(400, "সঠিক তথ্য দিন।");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "তথ্য অনেক বড়।");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid object");
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "সঠিক তথ্য দিন।");
  }
}
