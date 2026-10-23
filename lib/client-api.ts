/** Loose client JSON helper — API bodies are validated at use sites. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiJson = Record<string, any>;

export async function parseJson(res: Response): Promise<ApiJson> {
  return (await res.json()) as ApiJson;
}
