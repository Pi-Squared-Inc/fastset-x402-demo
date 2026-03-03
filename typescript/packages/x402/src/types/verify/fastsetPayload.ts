import { z } from "zod";

// FastSet transaction certificate schema (matches wallet extension API)
const FastSetTransactionCertificateSchema = z.object({
  envelope: z.object({
    transaction: z.object({
      sender: z.array(z.number()),
      recipient: z.array(z.number()),
      nonce: z.number(),
      timestamp_nanos: z.union([z.number(), z.bigint()]), // Can be large (nanoseconds since epoch)
      claim: z.any(), // Can be TokenTransfer or other claim types
      archival: z.boolean().optional(), // Optional archival flag
    }),
    signature: z.object({
      Signature: z.array(z.number()), // Wrapped in a Signature object
    }),
  }),
  signatures: z.array(z.tuple([z.array(z.number()), z.array(z.number())])),
});

// FastSet sign and send transaction payload (transaction executed immediately)
const FastSetSignAndSendTransactionPayloadSchema = z.object({
  type: z.literal("signAndSendTransaction"),
  transactionCertificate: FastSetTransactionCertificateSchema,
});
export type FastSetSignAndSendTransactionPayload = z.infer<
  typeof FastSetSignAndSendTransactionPayloadSchema
>;

// FastSet payload schema (single variant for now)
export const ExactFastSetPayloadSchema = FastSetSignAndSendTransactionPayloadSchema;

export type ExactFastSetPayload = z.infer<typeof ExactFastSetPayloadSchema>;

// Export schemas for external use
export {
  FastSetSignAndSendTransactionPayloadSchema,
  FastSetTransactionCertificateSchema,
};
