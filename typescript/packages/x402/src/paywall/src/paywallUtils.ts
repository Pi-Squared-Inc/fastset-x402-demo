import { selectPaymentRequirements } from "../../client";
import type { PaymentRequirements } from "../../types/verify";
import { Network, SupportedEVMNetworks, SupportedSVMNetworks, SupportedFastSetNetworks } from "../../types/shared";

const EVM_TESTNETS = new Set<Network>(["base-sepolia"]);
const SVM_TESTNETS = new Set<Network>(["solana-devnet"]);
const FASTSET_TESTNETS = new Set<Network>(["fastset-devnet"]);

/**
 * Normalizes the payment requirements into an array.
 *
 * @param paymentRequirements - A single requirement or a list of requirements.
 * @returns An array of payment requirements.
 */
export function normalizePaymentRequirements(
  paymentRequirements: PaymentRequirements | PaymentRequirements[],
): PaymentRequirements[] {
  if (Array.isArray(paymentRequirements)) {
    return paymentRequirements;
  }
  return [paymentRequirements];
}

/**
 * Returns the preferred networks to attempt first when selecting a payment requirement.
 *
 * @param testnet - Whether the paywall is operating in testnet mode.
 * @returns Ordered list of preferred networks.
 */
export function getPreferredNetworks(testnet: boolean): Network[] {
  if (testnet) {
    return ["base-sepolia", "solana-devnet", "fastset-devnet"];
  }
  return ["base", "solana"];
}

/**
 * Selects the most appropriate payment requirement for the user.
 *
 * @param paymentRequirements - All available payment requirements.
 * @param testnet - Whether the paywall is operating in testnet mode.
 * @returns The selected payment requirement.
 */
export function choosePaymentRequirement(
  paymentRequirements: PaymentRequirements | PaymentRequirements[],
  testnet: boolean,
): PaymentRequirements {
  const normalized = normalizePaymentRequirements(paymentRequirements);
  const preferredNetworks = getPreferredNetworks(testnet);

  return selectPaymentRequirements([...normalized], preferredNetworks as Network[], "exact");
}

/**
 * Determines if the provided network is an EVM network.
 *
 * @param network - The network to check.
 * @returns True if the network is EVM based.
 */
export function isEvmNetwork(network: string): network is Network {
  return SupportedEVMNetworks.includes(network as Network);
}

/**
 * Determines if the provided network is a Solana (SVM) network.
 *
 * @param network - The network to check.
 * @returns True if the network is SVM based.
 */
export function isSvmNetwork(network: string): network is Network {
  return SupportedSVMNetworks.includes(network as Network);
}

/**
 * Determines if the provided network is a FastSet network.
 *
 * @param network - The network to check.
 * @returns True if the network is FastSet based.
 */
export function isFastSetNetwork(network: string): network is Network {
  console.log("[PAYWALL-UTILS] isFastSetNetwork check:", network);
  console.log("[PAYWALL-UTILS] SupportedFastSetNetworks:", SupportedFastSetNetworks);
  const result = SupportedFastSetNetworks.includes(network as Network);
  console.log("[PAYWALL-UTILS] isFastSetNetwork result:", result);
  return result;
}

/**
 * Provides a human-readable display name for a network.
 *
 * @param network - The network identifier.
 * @returns A display name suitable for UI use.
 */
export function getNetworkDisplayName(network: Network): string {
  switch (network) {
    case "base":
      return "Base";
    case "base-sepolia":
      return "Base Sepolia";
    case "solana":
      return "Solana";
    case "solana-devnet":
      return "Solana Devnet";
    case "fastset-devnet":
      return "FastSet Devnet";
    default:
      return network;
  }
}

/**
 * Indicates whether the provided network is a testnet.
 *
 * @param network - The network to evaluate.
 * @returns True if the network is a recognized testnet.
 */
export function isTestnetNetwork(network: Network): boolean {
  return EVM_TESTNETS.has(network) || SVM_TESTNETS.has(network) || FASTSET_TESTNETS.has(network);
}
