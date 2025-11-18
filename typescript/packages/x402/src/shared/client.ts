import { getFastSetWallet, type FastSetWallet } from "../types/shared/fastset";

/**
 * Creates a FastSet client from the browser wallet extension
 * @returns A FastSet wallet client if available, null otherwise
 */
export function createFastSetClient(): FastSetWallet | null {
  return getFastSetWallet();
}
