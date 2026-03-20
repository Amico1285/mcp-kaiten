import { z } from "zod";

const envSchema = z.object({
  KAITEN_API_TOKEN: z.string().min(1, {
    message:
      "KAITEN_API_TOKEN is required. "
      + "Get it from Kaiten → Profile → API Key.",
  }),
  KAITEN_URL: z.string().min(1, {
    message:
      "KAITEN_URL is required "
      + "(e.g. https://your-domain.kaiten.ru).",
  }),
  KAITEN_DEFAULT_SPACE_ID: z
    .string()
    .transform((v) => {
      const n = parseInt(v, 10);
      return isNaN(n) ? undefined : n;
    })
    .optional(),
  KAITEN_REQUEST_TIMEOUT_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1000).max(60_000))
    .default("10000"),
  KAITEN_CACHE_TTL_MS: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0))
    .default("300000"),
});

type Config = {
  token: string;
  baseUrl: string;
  defaultSpaceId: number | undefined;
  requestTimeoutMs: number;
  cacheTtlMs: number;
};

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const messages = result.error.issues
      .map(
        (i) => `  ${i.path.join(".")}: ${i.message}`,
      )
      .join("\n");
    console.error(
      `mcp-kaiten config error:\n${messages}`,
    );
    process.exit(1);
  }

  const env = result.data;
  const url = env.KAITEN_URL.replace(/\/+$/, "");
  cached = {
    token: env.KAITEN_API_TOKEN,
    baseUrl: `${url}/api/latest`,
    defaultSpaceId: env.KAITEN_DEFAULT_SPACE_ID,
    requestTimeoutMs: env.KAITEN_REQUEST_TIMEOUT_MS,
    cacheTtlMs: env.KAITEN_CACHE_TTL_MS,
  };

  return cached;
}

export function getToken(): string {
  return getConfig().token;
}

export function getBaseUrl(): string {
  return getConfig().baseUrl;
}

export function getDefaultSpaceId():
  number | undefined {
  return getConfig().defaultSpaceId;
}
