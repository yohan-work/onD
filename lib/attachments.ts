import type { TextAttachment } from "@/lib/types";

export const MAX_ATTACHMENT_BYTES = 256 * 1024;
export const MAX_ATTACHMENTS = 4;

const ACCEPTED_TYPES = new Set(["text/plain", "text/markdown"]);
const ACCEPTED_EXTENSIONS = [".txt", ".md", ".markdown"];

export function isAcceptedTextFile(file: File) {
  const name = file.name.toLocaleLowerCase();
  return (
    ACCEPTED_TYPES.has(file.type) ||
    ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))
  );
}

export async function readTextAttachment(file: File): Promise<TextAttachment> {
  if (!isAcceptedTextFile(file)) {
    throw new Error("Only .txt and .md files are supported.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("Each attachment must be 256 KB or smaller.");
  }

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.name.toLocaleLowerCase().endsWith(".md")
      ? "text/markdown"
      : "text/plain",
    size: file.size,
    content: await file.text(),
  };
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export function buildAttachmentContext(attachments: TextAttachment[]) {
  if (attachments.length === 0) {
    return "";
  }

  return attachments
    .map(
      (attachment) =>
        `<attachment name="${attachment.name}">\n${attachment.content}\n</attachment>`,
    )
    .join("\n\n");
}
