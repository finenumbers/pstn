import { createHash } from "node:crypto";
import {
  SOURCE_FILES,
  type SourceFileKey,
} from "@/packages/import/constants";
import { getDownloadStream } from "@/packages/import/sourceFileHttp";

export type SourceFileHashes = Record<SourceFileKey, string>;

export async function hashSourceFile(url: string): Promise<string> {
  const response = await getDownloadStream(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}`);
  }

  const hash = createHash("sha256");
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }

  return hash.digest("hex");
}

export async function hashAllSourceFiles(): Promise<SourceFileHashes> {
  const result = {} as SourceFileHashes;
  for (const file of SOURCE_FILES) {
    result[file.key] = await hashSourceFile(file.url);
  }
  return result;
}

export function sourceHashesEqual(
  left: SourceFileHashes,
  right: SourceFileHashes
): boolean {
  return SOURCE_FILES.every((file) => left[file.key] === right[file.key]);
}
