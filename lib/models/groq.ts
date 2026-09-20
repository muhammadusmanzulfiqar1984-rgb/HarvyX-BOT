import { createGroq } from '@ai-sdk/groq';

/**
 * Fast/cheap tier — backs the Manager and Ops agents.
 *
 * NOTE: Groq's model catalog changes over time. As of this writing
 * `llama-3.1-70b-versatile` / `llama-3.3-70b-versatile` are no longer
 * listed on Groq's API — `openai/gpt-oss-120b` is the current general-purpose
 * default. Override with GROQ_FAST_MODEL if Groq's lineup changes again.
 */
export function fastModel(env: { GROQ_API_KEY: string; GROQ_FAST_MODEL?: string }) {
  const groq = createGroq({ apiKey: env.GROQ_API_KEY });
  return groq(env.GROQ_FAST_MODEL || 'openai/gpt-oss-120b');
}
