import type {
  ExactFastSetPayload,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "../types/verify";

/**
 * Convert hex string to BigInt
 */
function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

/**
 * FastSet Payment Payload type
 */
export type FastSetPaymentPayload = PaymentPayload & {
  network: "fastset-devnet";
  payload: ExactFastSetPayload;
};

/**
 * Create a FastSet RPC client
 * @param rpcUrl - The URL of the FastSet RPC endpoint
 */
function createFastSetRpc(rpcUrl: string) {
  return {
    async getAccountInfo(address: number[], certificateByNonce?: string) {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "set_proxy_getAccountInfo",
        params: {
          address,
          certificate_by_nonce: certificateByNonce,
        },
      };

      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `FastSet RPC call failed with status: ${response.status}`,
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("[ERROR-FASTSET-RPC] Failed to call FastSet RPC:", error);
        throw error;
      }
    },
  };
}

/**
 * Verify a FastSet payment for the exact scheme
 * Checks that the transaction is confirmed and contains a transfer to the correct address
 *
 * @param payload - The FastSet payment payload containing transaction data
 * @param paymentRequirements - The payment requirements to verify against
 * @returns VerifyResponse indicating if the payment is valid
 */
export async function verify(
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResponse> {
  console.log("FASTSET VERIFY");

  // Check if this is a FastSet payment
  if (payload.network !== "fastset-devnet") {
    return {
      isValid: false,
      invalidReason: "invalid_network",
    };
  }

  try {
    console.log(
      "[DEBUG-FASTSET-VERIFY] Starting FastSet payment verification",
      {
        network: payload.network,
        maxAmountRequired: paymentRequirements.maxAmountRequired,
        payTo: paymentRequirements.payTo,
      },
    );

    const fastsetPayload = payload.payload as ExactFastSetPayload;

    // Basic validation - check payload structure
    if (!fastsetPayload || !fastsetPayload.transactionCertificate) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
      };
    }

    const transaction =
      fastsetPayload.transactionCertificate.envelope.transaction;
    if (!transaction) {
      return {
        isValid: false,
        invalidReason: "invalid_payload",
      };
    }

    // Extract payer and nonce from transaction
    const sender = transaction.sender;
    const nonce = transaction.nonce;
    const recipient = transaction.recipient;

    console.log("[DEBUG-FASTSET-VERIFY] Extracted transaction details", {
      payer: sender,
      nonce,
      recipient,
    });

    if (sender === undefined) {
      return {
        isValid: false,
        invalidReason: "invalid_transaction_state",
      };
    }

    if (nonce === undefined) {
      return {
        isValid: false,
        invalidReason: "invalid_transaction_state",
      };
    }

    // Create FastSet RPC client and check account (using latest API endpoint)
    const fastSetRpc = createFastSetRpc("https://api.fast.xyz/proxy");

    try {
      console.log("[DEBUG-FASTSET-VERIFY] Calling FastSet RPC getAccountInfo", {
        address: sender,
        certificate_by_nonce: nonce,
      });

      const rpcResult = await fastSetRpc.getAccountInfo(sender, nonce.toString());

      console.log("[DEBUG-FASTSET-VERIFY] FastSet RPC response:");
      console.dir(rpcResult, { depth: null });

      // Verify the account info contains the expected transaction
      if (!rpcResult || !rpcResult.result) {
        return {
          isValid: false,
          invalidReason: "invalid_transaction_state",
        };
      }

      const accountInfo = rpcResult.result;
      const certificate = accountInfo.requested_certificate;

      if (!certificate || !certificate.envelope || !certificate.envelope.transaction) {
        return {
          isValid: false,
          invalidReason: "invalid_transaction_state",
        };
      }

      const envelope = certificate.envelope.transaction;

      if (envelope.nonce !== nonce) {
        return {
          isValid: false,
          invalidReason: "invalid_transaction_state",
        };
      }

      // Check sender matches
      if (JSON.stringify(sender) !== JSON.stringify(envelope.sender)) {
        return {
          isValid: false,
          invalidReason: "invalid_transaction_state",
        };
      }

      // Check recipient matches
      if (JSON.stringify(recipient) !== JSON.stringify(envelope.recipient)) {
        return {
          isValid: false,
          invalidReason: "invalid_transaction_state",
        };
      }

      const tokenTransfer = envelope.claim?.TokenTransfer;
      if (!tokenTransfer) {
        return {
          isValid: false,
          invalidReason: "invalid_transaction_state",
        };
      }

      // Convert hex amount to BigInt for comparison
      const amountDecimal = hexToBigInt(`0x${tokenTransfer.amount}`);
      const requiredAmount = BigInt(paymentRequirements.maxAmountRequired);

      if (amountDecimal < requiredAmount) {
        console.log("[DEBUG-FASTSET-VERIFY] Insufficient transfer amount", {
          required: requiredAmount.toString(),
          got: amountDecimal.toString(),
        });
        return {
          isValid: false,
          invalidReason: "insufficient_funds",
        };
      }

      console.log("[DEBUG-FASTSET-VERIFY] FastSet payment verification passed");

      // Convert sender array to a string representation for payer
      const payerString = `fastset:${sender.join(",")}`;

      return {
        isValid: true,
        payer: payerString,
      };
    } catch (rpcError) {
      console.error(
        "[ERROR-FASTSET-VERIFY] FastSet RPC call failed:",
        rpcError,
      );

      return {
        isValid: false,
        invalidReason: "unexpected_verify_error",
      };
    }
  } catch (error) {
    console.error("[ERROR-FASTSET-VERIFY] FastSet verification failed:", error);
    return {
      isValid: false,
      invalidReason: "unexpected_verify_error",
    };
  }
}

/**
 * Settle a FastSet payment for the exact scheme
 * For FastSet, this primarily validates that the payment was completed
 *
 * @param payload - The FastSet payment payload containing transaction data
 * @param paymentRequirements - The payment requirements to settle against
 * @returns SettleResponse indicating if the payment was settled
 */
export async function settle(
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
  console.log("FASTSET SETTLE");
  const valid = await verify(payload, paymentRequirements);

  if (!valid.isValid) {
    return {
      success: false,
      network: payload.network as "fastset-devnet",
      transaction: "",
      errorReason: valid.invalidReason ?? "invalid_scheme",
    };
  }

  try {
    // For FastSet, transactions are already settled on-chain when created
    // This function primarily validates and records the settlement

    console.log("[DEBUG-FASTSET-SETTLE] FastSet payment settled");

    const fastsetPayload = payload.payload as ExactFastSetPayload;
    const transactionStr = JSON.stringify(
      fastsetPayload.transactionCertificate?.envelope?.transaction || {}
    );

    return {
      success: true,
      network: payload.network as "fastset-devnet",
      transaction: transactionStr,
      payer: valid.payer,
    };
  } catch (error) {
    console.error("[ERROR-FASTSET-SETTLE] FastSet settlement failed:", error);
    return {
      success: false,
      network: payload.network as "fastset-devnet",
      transaction: "",
      errorReason: "unexpected_settle_error",
    };
  }
}

/**
 * Get supported payment kinds for FastSet
 */
export const Supported = {
  schemes: ["exact"] as const,
  networks: ["fastset-devnet"] as const,
};
