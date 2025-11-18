"use client";

import { useCallback, useMemo } from "react";
import type { PaymentRequirements } from "../../types/verify";
import { choosePaymentRequirement, isEvmNetwork, isSvmNetwork, isFastSetNetwork } from "./paywallUtils";
import { EvmPaywall } from "./EvmPaywall";
import { SolanaPaywall } from "./SolanaPaywall";
import { FastSetPaywall } from "./FastSetPaywall";

/**
 * Main Paywall App Component
 *
 * @returns The PaywallApp component
 */
export function PaywallApp() {
  console.log("[PAYWALL-APP] Component rendering started");
  console.log("[PAYWALL-APP] window.x402:", window.x402);
  const x402 = window.x402;
  const testnet = x402.testnet ?? true;

  const paymentRequirement = useMemo<PaymentRequirements>(() => {
    console.log("[PAYWALL-APP] Choosing payment requirement");
    console.log("[PAYWALL-APP] paymentRequirements:", x402.paymentRequirements);
    console.log("[PAYWALL-APP] testnet:", testnet);
    const chosen = choosePaymentRequirement(x402.paymentRequirements, testnet);
    console.log("[PAYWALL-APP] Chosen requirement:", chosen);
    return chosen;
  }, [testnet, x402.paymentRequirements]);

  const handleSuccessfulResponse = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("text/html")) {
      document.documentElement.innerHTML = await response.text();
    } else {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.location.href = url;
    }
  }, []);

  console.log("[PAYWALL-APP] Payment requirement:", paymentRequirement);
  console.log("[PAYWALL-APP] Network:", paymentRequirement?.network);

  if (!paymentRequirement) {
    console.log("[PAYWALL-APP] No payment requirement found - showing loading");
    return (
      <div className="container">
        <div className="header">
          <h1 className="title">Payment Required</h1>
          <p className="subtitle">Loading payment details...</p>
        </div>
      </div>
    );
  }

  console.log("[PAYWALL-APP] Checking network type...");
  console.log("[PAYWALL-APP] isEvmNetwork:", isEvmNetwork(paymentRequirement.network));
  console.log("[PAYWALL-APP] isSvmNetwork:", isSvmNetwork(paymentRequirement.network));
  console.log("[PAYWALL-APP] isFastSetNetwork:", isFastSetNetwork(paymentRequirement.network));

  if (isEvmNetwork(paymentRequirement.network)) {
    console.log("[PAYWALL-APP] Rendering EvmPaywall");
    return (
      <EvmPaywall
        paymentRequirement={paymentRequirement}
        onSuccessfulResponse={handleSuccessfulResponse}
      />
    );
  }

  if (isSvmNetwork(paymentRequirement.network)) {
    console.log("[PAYWALL-APP] Rendering SolanaPaywall");
    return (
      <SolanaPaywall
        paymentRequirement={paymentRequirement}
        onSuccessfulResponse={handleSuccessfulResponse}
      />
    );
  }

  if (isFastSetNetwork(paymentRequirement.network)) {
    console.log("[PAYWALL-APP] Rendering FastSetPaywall");
    return (
      <FastSetPaywall
        paymentRequirement={paymentRequirement}
        onSuccessfulResponse={handleSuccessfulResponse}
      />
    );
  }

  console.log("[PAYWALL-APP] No matching network type - showing unsupported");
  return (
    <div className="container">
      <div className="header">
        <h1 className="title">Payment Required</h1>
        <p className="subtitle">
          Unsupported network configuration for this paywall. Please contact the application
          developer.
        </p>
      </div>
    </div>
  );
}
