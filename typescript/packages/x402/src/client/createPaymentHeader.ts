import { createPaymentHeader as createPaymentHeaderExactEVM } from "../schemes/exact/evm/client";
import { createPaymentHeader as createPaymentHeaderExactSVM } from "../schemes/exact/svm/client";
import { createPaymentHeader as createPaymentHeaderExactFastSet } from "../schemes/exact/fastset/client";
import { isEvmSignerWallet, isMultiNetworkSigner, isSvmSignerWallet, MultiNetworkSigner, Signer, SupportedEVMNetworks, SupportedSVMNetworks, SupportedFastSetNetworks } from "../types/shared";
import { PaymentRequirements } from "../types/verify";
import { X402Config } from "../types/config";
import type { FastSetWallet } from "../types/shared/fastset";

/**
 * Creates a payment header based on the provided client and payment requirements.
 *
 * @param client - The signer wallet instance or FastSet wallet used to create the payment header
 * @param x402Version - The version of the X402 protocol to use
 * @param paymentRequirements - The payment requirements containing scheme and network information
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A promise that resolves to the created payment header string
 */
export async function createPaymentHeader(
  client: Signer | MultiNetworkSigner | FastSetWallet,
  x402Version: number,
  paymentRequirements: PaymentRequirements,
  config?: X402Config,
): Promise<string> {
  // exact scheme
  if (paymentRequirements.scheme === "exact") {
    // fastset - handle browser wallet
    if (SupportedFastSetNetworks.includes(paymentRequirements.network)) {
      // For FastSet, client should be the browser wallet directly
      if (!isFastSetWallet(client)) {
        throw new Error("Invalid FastSet wallet client provided");
      }

      return await createPaymentHeaderExactFastSet(
        client,
        x402Version,
        paymentRequirements,
        config,
      );
    }
    // evm
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      const evmClient = isMultiNetworkSigner(client) ? client.evm : (client as Signer);

      if (!isEvmSignerWallet(evmClient)) {
        throw new Error("Invalid evm wallet client provided");
      }

      return await createPaymentHeaderExactEVM(
        evmClient,
        x402Version,
        paymentRequirements,
      );
    }
    // svm
    if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      const svmClient = isMultiNetworkSigner(client) ? client.svm : (client as Signer);
      if (!isSvmSignerWallet(svmClient)) {
        throw new Error("Invalid svm wallet client provided");
      }

      return await createPaymentHeaderExactSVM(
        svmClient,
        x402Version,
        paymentRequirements,
        config,
      );
    }
    throw new Error("Unsupported network");
  }
  throw new Error("Unsupported scheme");
}

/**
 * Type guard to check if a client is a FastSet wallet
 */
function isFastSetWallet(client: any): client is FastSetWallet {
  return (
    client &&
    typeof client === "object" &&
    "connect" in client &&
    "getAccounts" in client &&
    "transfer" in client &&
    typeof client.connect === "function" &&
    typeof client.getAccounts === "function" &&
    typeof client.transfer === "function"
  );
}