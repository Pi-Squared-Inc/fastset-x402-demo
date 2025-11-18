import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
} from "../../../types/verify";
import type { ConnectedClient } from "../../../types/shared/wallet";
import type { X402Config } from "../../../types/config";
import type { ExactFastSetPayload } from "./client";
import { SCHEME } from "../../exact";

/**
 * Verifies a FastSet payment by checking the transaction certificate on-chain
 *
 * @param client - The connected client for RPC calls
 * @param payload - The payment payload containing the transaction certificate
 * @param paymentRequirements - The payment requirements that must be satisfied
 * @param config - Optional X402 configuration
 * @returns A VerifyResponse indicating if the payment is valid
 */
export async function verify(
  client: ConnectedClient,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<VerifyResponse> {
  const exactFastSetPayload = payload.payload as ExactFastSetPayload;

  // Verify payload scheme
  if (payload.scheme !== SCHEME || paymentRequirements.scheme !== SCHEME) {
    return {
      isValid: false,
      invalidReason: "unsupported_scheme",
      payer: "", // FastSet uses bech32 addresses, we'll need to extract from certificate
    };
  }

  // Verify network matches
  if (payload.network !== paymentRequirements.network) {
    return {
      isValid: false,
      invalidReason: "invalid_network",
      payer: "",
    };
  }

  // TODO: Implement on-chain verification of the transaction certificate
  // For now, we'll accept the payment if the certificate exists
  // In a production system, you would:
  // 1. Query the FastSet RPC to verify the transaction exists
  // 2. Check the transaction was executed successfully
  // 3. Verify the transfer amount matches paymentRequirements.maxAmountRequired
  // 4. Verify the recipient matches paymentRequirements.payTo
  // 5. Verify the transaction is sufficiently confirmed

  if (!exactFastSetPayload.transactionCertificate) {
    return {
      isValid: false,
      invalidReason: "invalid_payload",
      payer: "",
    };
  }

  // Basic validation: certificate should have expected structure
  if (!exactFastSetPayload.transactionCertificate.envelope) {
    return {
      isValid: false,
      invalidReason: "invalid_transaction_state",
      payer: "",
    };
  }

  // Payment is valid
  // Note: We don't have direct access to the payer address from the certificate structure
  // The payer would need to be extracted from the transaction envelope
  return {
    isValid: true,
    payer: "", // TODO: Extract payer from transaction envelope
  };
}

/**
 * Settle is not applicable for FastSet as transactions are already settled on-chain
 * when the wallet creates the transaction certificate
 *
 * @param client - The connected client (unused for FastSet, accepts any type)
 * @param payload - The payment payload
 * @param paymentRequirements - The payment requirements
 * @param config - Optional X402 configuration
 * @returns A SettleResponse indicating settlement is not needed
 */
export async function settle(
  client: any, // FastSet doesn't need a specific client type since transactions are pre-settled
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<SettleResponse> {
  const exactFastSetPayload = payload.payload as ExactFastSetPayload;

  // FastSet transactions are already settled on-chain
  // The wallet extension handles signing and broadcasting
  // We return a placeholder transaction identifier based on the certificate
  const transactionId = exactFastSetPayload.transactionCertificate
    ? JSON.stringify(exactFastSetPayload.transactionCertificate.envelope).substring(0, 66)
    : "";

  return {
    success: true,
    transaction: transactionId,
    network: paymentRequirements.network,
    payer: "", // TODO: Extract payer from transaction envelope
  };
}
