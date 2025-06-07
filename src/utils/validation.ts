import { z } from 'zod';

export const identifySchema = z
  .object({
    // Preprocess: turn "", null into undefined; leave other values alone
    email: z.preprocess(
      (val) => {
        if (val === null) return undefined;
        if (typeof val === 'string' && val.trim() === '') return undefined;
        return val;
      },
      z.string().email().optional(),  // now optional string which if present must be an email
    ),
    phoneNumber: z.preprocess(
      (val) => {
        if (val === null) return undefined;
        if (typeof val === 'string' && val.trim() === '') return undefined;
        return val;
      },
      z.string().optional(),          // optional string of any non-empty text
    ),
  })
  .refine(
    (data) => Boolean(data.email) || Boolean(data.phoneNumber),
    { message: 'At least one of email or phoneNumber is required' },
  );

// Types & helper
export type IdentifyInput = z.infer<typeof identifySchema>;
export function validateIdentifyInput(payload: unknown): IdentifyInput {
  return identifySchema.parse(payload);
}
