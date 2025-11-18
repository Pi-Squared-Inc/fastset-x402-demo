"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaymentRequirements } from "../../types/verify";
import { exact } from "../../schemes";
import { Spinner } from "./Spinner";
import { getNetworkDisplayName } from "./paywallUtils";
import { isFastSetWalletAvailable, getFastSetWallet } from "../../types/shared/fastset";

type FastSetPaywallProps = {
  paymentRequirement: PaymentRequirements;
  onSuccessfulResponse: (response: Response) => Promise<void>;
};

/**
 * Paywall experience for FastSet networks.
 *
 * @param props - Component props.
 * @param props.paymentRequirement - Payment requirement enforced for FastSet requests.
 * @param props.onSuccessfulResponse - Callback invoked on successful 402 response.
 * @returns JSX element.
 */
export function FastSetPaywall({ paymentRequirement, onSuccessfulResponse }: FastSetPaywallProps) {
  const [status, setStatus] = useState<string>("");
  const [isPaying, setIsPaying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>("");

  const x402 = window.x402;
  const amount = typeof x402.amount === "number" ? x402.amount : Number(paymentRequirement.maxAmountRequired ?? 0);
  const network = paymentRequirement.network;
  const chainName = getNetworkDisplayName(network);
  const [version, setVersion] = useState<number>(1);

  // Check if FastSet wallet is available
  useEffect(() => {
    if (isFastSetWalletAvailable()) {
      const wallet = getFastSetWallet();
      if (wallet && wallet.isConnected()) {
        wallet.getAccounts().then(accounts => {
          if (accounts && accounts.length > 0) {
            setIsConnected(true);
            setWalletAddress(accounts[0].address);
          }
        }).catch(console.error);
      }
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (!isFastSetWalletAvailable()) {
      setStatus("FastSet wallet not detected. Please install the FastSet browser extension.");
      return;
    }

    const wallet = getFastSetWallet();
    if (!wallet) {
      setStatus("Failed to get FastSet wallet instance.");
      return;
    }

    try {
      setStatus("Connecting to FastSet wallet...");
      const connected = await wallet.connect({ permissions: ["viewAccount", "suggestTransactions"] });
      
      if (!connected) {
        throw new Error("Failed to connect to FastSet wallet");
      }

      const accounts = await wallet.getAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available in FastSet wallet");
      }

      setIsConnected(true);
      setWalletAddress(accounts[0].address);
      setStatus("");
    } catch (error) {
      console.error("Failed to connect wallet", error);
      setStatus(error instanceof Error ? error.message : "Failed to connect wallet.");
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    const wallet = getFastSetWallet();
    if (wallet) {
      wallet.disconnect();
      setIsConnected(false);
      setWalletAddress("");
      setStatus("");
    }
  }, []);

  const handlePay = useCallback(async () => {
    const wallet = getFastSetWallet();
    if (!wallet) {
      setStatus("FastSet wallet not available.");
      return;
    }

    if (!isConnected) {
      setStatus("Please connect your FastSet wallet first.");
      return;
    }

    setIsPaying(true);
    setStatus("Creating payment...");

    try {
      // Create payment header using FastSet wallet
      const paymentHeader = await exact.fastset.createPaymentHeader(
        wallet,
        version,
        paymentRequirement,
      );

      setStatus("Sending payment request...");
      const response = await fetch(window.location.href, {
        headers: { "X-Payment": paymentHeader },
      });

      if (response.ok) {
        setStatus("Payment successful! Loading content...");
        await onSuccessfulResponse(response);
      } else {
        const errorText = await response.text();
        throw new Error(`Payment failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error("Payment error:", error);
      setStatus(error instanceof Error ? error.message : "Payment failed. Please try again.");
    } finally {
      setIsPaying(false);
    }
  }, [isConnected, version, paymentRequirement, onSuccessfulResponse]);

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p className="subtitle">
          Connect your FastSet wallet and pay to access this content on {chainName}
        </p>
      </div>

      <div className="content">
        {!isFastSetWalletAvailable() ? (
          <div className="warning">
            <p>FastSet wallet extension not detected.</p>
            <p>Please install the FastSet browser extension to continue.</p>
          </div>
        ) : !isConnected ? (
          <div className="wallet-connect">
            <button onClick={handleConnect} className="button primary" disabled={isPaying}>
              Connect FastSet Wallet
            </button>
          </div>
        ) : (
          <div className="payment-section">
            <div className="wallet-info">
              <p className="label">Connected Wallet:</p>
              <p className="address">{walletAddress}</p>
              <button onClick={handleDisconnect} className="button secondary small">
                Disconnect
              </button>
            </div>

            <div className="payment-amount">
              <p className="label">Amount to Pay:</p>
              <p className="amount">{amount} SET</p>
            </div>

            <button
              onClick={handlePay}
              className="button primary"
              disabled={isPaying || !isConnected}
            >
              {isPaying ? (
                <>
                  <Spinner /> Processing...
                </>
              ) : (
                "Pay Now"
              )}
            </button>
          </div>
        )}

        {status && (
          <div className={`status ${status.includes("successful") ? "success" : ""}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
