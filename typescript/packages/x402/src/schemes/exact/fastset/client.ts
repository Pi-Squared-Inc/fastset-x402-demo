import { encodePayment } from "../../utils";
import type { PaymentPayload, PaymentRequirements } from "../../../types/verify";
import type { X402Config } from "../../../types/config";
import {
  type FastSetWallet,
  type FastSetTransferParams,
  type FastSetTransactionCertificate,
  toHexAmount,
} from "../../../types/shared/fastset";

/**
 * FastSet payment payload with transaction certificate
 */
export interface ExactFastSetPayload {
  type: "signAndSendTransaction";
  transactionCertificate: FastSetTransactionCertificate;
}

/**
 * Creates and signs a FastSet payment by executing a transfer through the wallet
 *
 * @param client - The FastSet wallet client
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param config - Optional configuration for X402 operations
 * @returns A FastSet payment payload with the transaction certificate
 */
async function createAndSignPayment(
  client: FastSetWallet,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<PaymentPayload> {
  if (!client.getAccounts) {
    throw new Error("FastSet wallet is not properly initialized");
  }

  // Get the accounts from the wallet
  const accounts = await client.getAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error("No FastSet accounts available");
  }

  // Use the first account (active account)
  const fromAccount = accounts[0];

  // Convert amount to hex format
  const amountBigInt = BigInt(paymentRequirements.maxAmountRequired);
  const hexAmount = toHexAmount(amountBigInt);

  // Check if wallet supports transfer function
  if (!client.transfer) {
    throw new Error("FastSet wallet does not support transfer function");
  }

  // Prepare transfer parameters
  const transferParams: FastSetTransferParams = {
    amount: hexAmount,
    recipient: paymentRequirements.payTo,
    account: fromAccount,
    // Use asset as tokenId if it's not the native token address
    tokenId: paymentRequirements.asset !== "0xfa575e7000000000000000000000000000000000000000000000000000000000"
      ? paymentRequirements.asset
      : undefined,
  };

  console.log("[DEBUG] FastSet transfer parameters being sent to wallet:", {
    transferParams,
    paymentRequirements,
    hexAmount,
    amountBigInt: amountBigInt.toString(),
  });

  // Execute the transfer - wallet will handle signing and sending
  const transactionCertificate: FastSetTransactionCertificate =
    await client.transfer(transferParams);

  console.log("[DEBUG] FastSet transfer result received from wallet:", {
    transactionCertificate,
  });

  // Create the payment payload with type discriminator
  const payload: ExactFastSetPayload = {
    type: "signAndSendTransaction",
    transactionCertificate,
  };

  return {
    x402Version,
    scheme: "exact",
    network: paymentRequirements.network,
    payload,
  };
}

/**
 * Creates and encodes a payment header for the given client and payment requirements.
 *
 * @param client - The FastSet wallet client
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param config - Optional configuration for X402 operations
 * @returns A promise that resolves to a base64 encoded payment header string
 */
export async function createPaymentHeader(
  client: FastSetWallet,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<string> {
  const paymentPayload = await createAndSignPayment(
    client,
    x402Version,
    paymentRequirements,
    config,
  );

  return encodePayment(paymentPayload);
}
