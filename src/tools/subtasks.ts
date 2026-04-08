import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  asV,
  simplifyCard, simplifyList,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

export type SubtasksClient = {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
};

export async function listSubtasksSimplified(
  cardId: number,
  v: Verbosity,
  client: Pick<SubtasksClient, "get"> = { get },
): Promise<unknown> {
  const children = await client.get(
    `/cards/${cardId}/children`,
  );
  return simplifyList(children, simplifyCard, v);
}

export async function attachSubtask(
  parentCardId: number,
  childCardId: number,
  client: Pick<SubtasksClient, "post"> = { post },
): Promise<void> {
  await client.post(
    `/cards/${parentCardId}/children`,
    { card_id: childCardId },
  );
}

export async function detachSubtask(
  parentCardId: number,
  childCardId: number,
  client: Pick<SubtasksClient, "del"> = { del },
): Promise<void> {
  await client.del(
    `/cards/${parentCardId}/children/${childCardId}`,
  );
}

export function registerSubtaskTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_subtasks",
    {
      title: "List Subtasks",
      description:
        "Linked child cards. Add: kaiten_create_card + "
        + "kaiten_attach_subtask; or kaiten_get_card "
        + "includeChildren.",
      inputSchema: {
        cardId: z.coerce.number().int().describe(
          "Parent card ID",
        ),
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
      const simplified = await listSubtasksSimplified(
        cardId, v,
      );
      return jsonResult(simplified);
    }),
  );

  server.registerTool(
    "kaiten_attach_subtask",
    {
      title: "Attach Subtask",
      description:
        "Link child to parent. Child via kaiten_create_card; "
        + "check kaiten_list_subtasks.",
      inputSchema: {
        parentCardId: z.coerce.number().int().describe(
          "Parent card ID",
        ),
        childCardId: z.coerce.number().int().describe(
          "Child card ID",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      parentCardId, childCardId,
    }) => {
      await attachSubtask(parentCardId, childCardId);
      return textResult(
        `Card ${childCardId} attached as subtask `
          + `of ${parentCardId}`,
      );
    }),
  );

  server.registerTool(
    "kaiten_detach_subtask",
    {
      title: "Detach Subtask",
      description:
        "Unlink child from parent; cards stay. Inverse of "
        + "kaiten_attach_subtask.",
      inputSchema: {
        parentCardId: z.coerce.number().int().describe(
          "Parent card ID",
        ),
        childCardId: z.coerce.number().int().describe(
          "Child card ID",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      parentCardId, childCardId,
    }) => {
      await detachSubtask(parentCardId, childCardId);
      return textResult(
        `Card ${childCardId} detached from `
          + `${parentCardId}`,
      );
    }),
  );
}
