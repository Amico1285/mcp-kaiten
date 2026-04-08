import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import { positiveId, type Obj } from "../utils/schemas.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";
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
        "List child cards linked to a parent card. `cardId` "
        + "is the PARENT card; the tool returns its CHILD "
        + "cards. Add new children: kaiten_create_card + "
        + "kaiten_attach_subtask. An alternative is "
        + "kaiten_get_card(cardId, includeChildren=true), "
        + "which embeds the children inline.",
      inputSchema: {
        cardId: positiveId("Parent card ID"),
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
        "Link an existing child card to a parent card. "
        + "Subtask = a real Kaiten card linked as a child "
        + "(NOT a checklist item — for to-do items use "
        + "kaiten_add_checklist_item). Child via "
        + "kaiten_create_card; verify via kaiten_list_subtasks. "
        + "Idempotent — re-attaching the same pair returns "
        + "success without creating a duplicate link. Cycles "
        + "(A→B and B→A) and cross-board attaches are accepted "
        + "by Kaiten without warning.",
      inputSchema: {
        parentCardId: positiveId("Parent card ID"),
        childCardId: positiveId("Child card ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
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
        + "kaiten_attach_subtask. WARNING: Detaching a "
        + "non-existent or wrong-pair link returns success "
        + "silently. Verify the link exists via "
        + "kaiten_list_subtasks(parentCardId) before relying "
        + "on the success message.",
      inputSchema: {
        parentCardId: positiveId("Parent card ID"),
        childCardId: positiveId("Child card ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      parentCardId, childCardId,
    }) => {
      await assertChildBelongsToParent({
        toolName: "kaiten_detach_subtask",
        childId: childCardId,
        childDescriptor: `card ${childCardId}`,
        parentDescriptor: `parent card ${parentCardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${parentCardId}/children`,
        ),
      });
      await detachSubtask(parentCardId, childCardId);
      return textResult(
        `Card ${childCardId} detached from `
          + `${parentCardId}`,
      );
    }),
  );
}
