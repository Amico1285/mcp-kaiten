const MAX_RESPONSE_LENGTH = 100_000;

function truncateResponse(text: string): string {
  if (text.length <= MAX_RESPONSE_LENGTH) return text;

  const dropped = text.length - MAX_RESPONSE_LENGTH;
  return text.slice(0, MAX_RESPONSE_LENGTH)
    + `\n\n--- TRUNCATED ---\n`
    + `Showing ${MAX_RESPONSE_LENGTH} of `
    + `${text.length} chars (${dropped} dropped).\n`
    + `Use filters or lower limit to reduce size.`;
}

type ToolResult = {
  content: { type: "text"; text: string }[];
};

type ErrorResult = ToolResult & { isError: true };

export function jsonResult(
  data: unknown,
): ToolResult {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{
      type: "text",
      text: truncateResponse(text),
    }],
  };
}

export function textResult(
  message: string,
): ToolResult {
  return {
    content: [{ type: "text", text: message }],
  };
}

export function formatApiError(
  error: unknown,
): ErrorResult {
  const message = error instanceof Error
    ? error.message
    : String(error);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export function handleTool<T>(
  fn: (args: T) => Promise<ToolResult>,
): (args: T) => Promise<ToolResult | ErrorResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (error) {
      return formatApiError(error);
    }
  };
}
