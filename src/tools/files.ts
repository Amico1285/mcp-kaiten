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

function simplifyFile(
  f: Obj,
  v: Verbosity,
): Obj {
  if (v === "raw") return f;
  const result: Obj = {
    id: f.id,
    name: f.name ?? f.file_name,
    size: f.size,
  };
  if (v !== "min") {
    result.content_type = f.content_type ?? null;
    result.created = f.created;
    result.author_id = f.author_id ?? null;
    result.url = f.url ?? null;
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
        + "large files.",
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
