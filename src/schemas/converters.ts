import { z } from 'zod';

/**
 * Minimal helper to parse Firestore payloads with a Zod schema.
 * Integrate at call-sites by invoking `parser.parse(snapshot.data())`.
 */
export function makeZodParser<T>(schema: z.ZodType<T>) {
  return {
    parse(data: unknown): T {
      return schema.parse(data);
    },
    safeParse(data: unknown) {
      return schema.safeParse(data);
    }
  };
}


