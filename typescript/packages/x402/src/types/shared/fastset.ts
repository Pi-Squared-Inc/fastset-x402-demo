/**
 * FastSet-specific type definitions
 */

export interface FastSetAccountInfo {
  address: string; // FastSet address format (starts with "set")
  publicKey: string;
}

export interface FastSetTransaction {
  sender: number[]; // 32-byte array
  recipient: number[]; // 32-byte array
  nonce: number;
  timestamp_nanos: number;
  claim: {
    TokenTransfer?: {
      amount: string; // Hex string like "64"
      token_id: number[]; // 32-byte array
      user_data: number[] | null;
    };
  };
}

export interface FastSetTransactionEnvelope {
  transaction: FastSetTransaction;
  signature: {
    Signature: number[];
  };
}

export interface FastSetTransactionCertificate {
  envelope: FastSetTransactionEnvelope;
  signatures: Array<[number[], number[]]>;
}

export interface FastSetTransferParams {
  amount: string; // Hex string like "0x64" for 100
  recipient: string;
  account: FastSetAccountInfo;
  tokenId?: string; // Optional tokenId for custom tokens, defaults to native token
}

export interface FastSetWallet {
  connect: (options: { permissions: string[] }) => Promise<boolean>;
  disconnect: () => void;
  isConnected: () => boolean;
  getAccounts: () => Promise<FastSetAccountInfo[]>;
  getActiveNetwork: () => Promise<string>;
  getPublicKey: () => Promise<Uint8Array>;
  transfer: (params: FastSetTransferParams) => Promise<FastSetTransactionCertificate>;
}

declare global {
  interface Window {
    fastset?: FastSetWallet;
  }
}

export type FastSetPermission = "viewAccount" | "suggestTransactions";

export interface FastSetConnectOptions {
  permissions: FastSetPermission[];
}

export type FastSetNetworkId = "devnet"; // Only devnet for now
export type FastSetAmount = string; // Hex string like "0x64"
export type FastSetAddress = string; // Format: "set..."
export type FastSetTokenId = string;

export function isValidFastSetAddress(address: string): address is FastSetAddress {
  return typeof address === "string" && address.startsWith("set");
}

export function toHexAmount(amount: bigint): FastSetAmount {
  return "0x" + amount.toString(16);
}

export function fromHexAmount(hexAmount: FastSetAmount): bigint {
  return BigInt(hexAmount);
}

export function isFastSetWalletAvailable(): boolean {
  return typeof window !== "undefined" && window.fastset !== undefined;
}

export function getFastSetWallet(): FastSetWallet | null {
  if (isFastSetWalletAvailable()) {
    return window.fastset as FastSetWallet;
  }
  return null;
}

/**
 * FastSet Connected Client for RPC calls
 */
export interface FastSetConnectedClient {
  network: string;
  rpcUrl: string;
  getAccountInfo: (address: number[], certificateByNonce?: string) => Promise<any>;
}

/**
 * Creates a FastSet RPC client for the specified network
 */
export function createFastSetConnectedClient(network: string): FastSetConnectedClient {
  // Map network to RPC URL - using the latest FastSet API endpoint
  const rpcUrl = network === "fastset-devnet" 
    ? "https://api.fast.xyz/proxy"
    : "https://api.fast.xyz/proxy"; // Default to devnet for now

  return {
    network,
    rpcUrl,
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

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`FastSet RPC call failed with status: ${response.status}`);
      }

      return await response.json();
    },
  };
}
