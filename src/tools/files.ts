import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, uploadFile, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

// Real /cards/{id}/files response carries `mime_type`
// (the documented `content_type` field doesn't exist — that
// was a guess that always returned null). Even `mime_type`
// is null for regular uploads: Kaiten doesn't parse the
// multipart Content-Type. We compensate with a tiny extension
// → MIME map so callers see something meaningful for the
// common cases. Source attribution lives in `type` (1=direct
// attachment, 2-6=cloud drives, 7-8=comment, 11=private).
const EXT_TO_MIME: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
};

const FILE_SOURCE: Record<number, string> = {
  1: "attachment",
  2: "googleDrive",
  3: "dropBox",
  4: "box",
  5: "oneDrive",
  6: "yandexDisk",
  7: "commentEmail",
  8: "commentAttachment",
  11: "private",
};

function mimeFromName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

function simplifyFile(
  f: Obj,
  v: Verbosity,
): Obj {
  if (v === "raw") return f;
  const name = f.name ?? f.file_name;
  const mime = (f.mime_type as string | null | undefined)
    ?? mimeFromName(name);

  const result: Obj = {
    id: f.id,
    name,
    size: f.size,
    mime_type: mime ?? null,
  };
  if (v !== "min") {
    result.url = f.url ?? null;
    result.source = typeof f.type === "number"
      ? FILE_SOURCE[f.type] ?? f.type
      : null;
    result.created = f.created;
    result.author_id = f.author_id ?? null;
  }
  if (v === "max") {
    result.uid = f.uid ?? null;
    result.thumbnail_url = f.thumbnail_url ?? null;
    result.card_cover = !!f.card_cover;
    result.external = !!f.external;
    result.comment_id = f.comment_id ?? null;
    result.sort_order = f.sort_order ?? null;
  }
  return result;
}

export function registerFileTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_files",
    {
      title: "List Files",
      description:
        "List card attachments. fileId for kaiten_delete_file; "
        + "cardId from kaiten_search_cards or kaiten_get_card.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ cardId, verbosity }) => {
      const v = asV(verbosity);
      const files = await get<Obj[]>(
        `/cards/${cardId}/files`,
      );
      return jsonResult(
        files.map((f) => simplifyFile(f, v)),
      );
    }),
  );

  server.registerTool(
    "kaiten_upload_file",
    {
      title: "Upload File",
      description:
        "Upload file attachment (base64). Verify with "
        + "kaiten_list_files. Prefer description links for "
        + "large files. Note: Kaiten does not persist the "
        + "multipart Content-Type — `mime_type` in responses "
        + "is inferred from the file extension.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        fileName: z.string().describe("File name"),
        contentBase64: z.string().describe(
          "File content as base64 string",
        ),
        contentType: z.string().default(
          "application/octet-stream",
        ).describe("MIME type"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      cardId, fileName, contentBase64,
      contentType, verbosity,
    }) => {
      const v = asV(verbosity);
      const file = await uploadFile<Obj>(
        `/cards/${cardId}/files`,
        fileName,
        contentBase64,
        contentType,
      );
      return jsonResult(simplifyFile(file, v));
    }),
  );

  server.registerTool(
    "kaiten_delete_file",
    {
      title: "Delete File",
      description:
        "Remove an attachment. fileId and cardId come "
        + "from kaiten_list_files.",
      inputSchema: {
        cardId: z.coerce.number().int().describe("Card ID"),
        fileId: z.coerce.number().int().describe("File ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, fileId }) => {
      await del(
        `/cards/${cardId}/files/${fileId}`,
      );
      return textResult(
        `File ${fileId} deleted from card ${cardId}`,
      );
    }),
  );
}
