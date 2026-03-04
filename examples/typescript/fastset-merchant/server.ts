import { config } from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import { paymentMiddleware } from "x402-express";

config();

const PORT = process.env.PORT || 3001;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3002";

// Merchant's Fast network address (receives payments)
const FASTSET_MERCHANT_ADDRESS = process.env.FASTSET_MERCHANT_ADDRESS || "fast16h3jkg5sv9ng2hwcjz08w3x2qvhxnzk5sw5awkqkgwrg3kv4hd7qylc73u";

// Merchant's EVM address for Arbitrum Sepolia (receives USDC payments)
const EVM_MERCHANT_ADDRESS = process.env.EVM_MERCHANT_ADDRESS || "0x1131623344cFdb04D06a9eD511BEc56FF6Ae4372";

const app = express();
app.use(express.json());

// ─── Logging Helpers ─────────────────────────────────────────────────────────

function logSeparator() {
  console.log("═".repeat(80));
}

function logStep(step: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [MERCHANT] ${step}`, ...args);
}

function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    "arbitrum-sepolia": `https://sepolia.arbiscan.io/tx/${txHash}`,
    "arbitrum": `https://arbiscan.io/tx/${txHash}`,
    "base-sepolia": `https://sepolia.basescan.org/tx/${txHash}`,
    "base": `https://basescan.org/tx/${txHash}`,
    "fastset-devnet": `https://explorer.fast.xyz/tx/${txHash}`,
  };
  return explorers[network] || `Unknown network: ${network}, txHash: ${txHash}`;
}

// ─── Request Logging Middleware ──────────────────────────────────────────────

app.use("/api/*", (req: Request, res: Response, next: NextFunction) => {
  const hasPayment = !!req.header("X-PAYMENT");
  
  logSeparator();
  logStep("INCOMING REQUEST");
  console.log("  Method:", req.method);
  console.log("  Path:", req.path);
  console.log("  X-PAYMENT:", hasPayment ? `YES (${req.header("X-PAYMENT")!.length} bytes)` : "NO");
  
  if (hasPayment) {
    try {
      const payloadBase64 = req.header("X-PAYMENT")!;
      const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString());
      logStep("PARSED X-PAYMENT PAYLOAD:");
      console.log("  x402Version:", payload.x402Version);
      console.log("  scheme:", payload.scheme);
      console.log("  network:", payload.network);
      
      if (payload.payload) {
        if (payload.payload.signature) {
          console.log("  payload.signature:", payload.payload.signature.slice(0, 30) + "...");
        }
        if (payload.payload.authorization) {
          console.log("  payload.authorization:");
          console.log("    from:", payload.payload.authorization.from);
          console.log("    to:", payload.payload.authorization.to);
          console.log("    value:", payload.payload.authorization.value, `(${parseInt(payload.payload.authorization.value) / 1e6} USDC)`);
          console.log("    nonce:", payload.payload.authorization.nonce?.slice(0, 20) + "...");
        }
        if (payload.payload.transactionCertificate) {
          console.log("  payload.transactionCertificate: [FastSet certificate present]");
        }
      }
    } catch (e) {
      logStep("Failed to parse X-PAYMENT:", e);
    }
    logStep("→ Forwarding to facilitator for verification...");
  } else {
    logStep("→ No payment header, will return 402 Payment Required");
  }
  
  // Intercept res.json to log 402 responses
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    if (res.statusCode === 402) {
      logStep("SENDING 402 PAYMENT REQUIRED");
      console.log("  Error:", body.error);
      if (body.accepts?.[0]) {
        const req = body.accepts[0];
        console.log("  Payment Requirements:");
        console.log("    scheme:", req.scheme);
        console.log("    network:", req.network);
        console.log("    amount:", req.maxAmountRequired, `(${parseInt(req.maxAmountRequired) / 1e6} USDC)`);
        console.log("    payTo:", req.payTo);
        console.log("    asset:", req.asset);
        if (req.extra) {
          console.log("    extra.name:", req.extra.name);
          console.log("    extra.version:", req.extra.version);
        }
      }
    }
    return originalJson(body);
  };

  // Intercept res.setHeader to detect X-PAYMENT-RESPONSE (settlement success)
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name: string, value: any) {
    if (name === "X-PAYMENT-RESPONSE") {
      try {
        const decoded = JSON.parse(Buffer.from(value, "base64").toString());
        logStep("FACILITATOR RESPONSE RECEIVED");
        console.log("  Success:", decoded.success);
        console.log("  Network:", decoded.network);
        if (decoded.payer) console.log("  Payer:", decoded.payer);
        if (decoded.txHash) {
          console.log("  TxHash:", decoded.txHash);
          console.log("  Explorer:", getExplorerUrl(decoded.network, decoded.txHash));
        }
      } catch (e) {
        logStep("X-PAYMENT-RESPONSE set (could not parse)");
      }
    }
    return originalSetHeader(name, value);
  };
  
  next();
});

// ─── Logging Facilitator Wrapper ─────────────────────────────────────────────

const loggingFacilitator = {
  url: FACILITATOR_URL,
  createAuthHeaders: async () => {
    logStep("CALLING FACILITATOR");
    console.log("  URL:", FACILITATOR_URL);
    return {
      verify: {},
      settle: {},
    };
  },
};

// ─── x402 Payment Middleware - FastSet Routes ────────────────────────────────

app.use(
  paymentMiddleware(
    FASTSET_MERCHANT_ADDRESS,
    {
      "GET /api/fast-service": {
        price: "$0.10",
        network: "fastset-devnet",
        config: {
          description: "AI Agent Premium Service (FastSet) - Pay per API call",
          mimeType: "application/json",
        },
      },
      "GET /api/service": {
        price: "$0.10",
        network: "fastset-devnet",
        config: {
          description: "AI Agent Premium Service - Pay per API call",
          mimeType: "application/json",
        },
      },
      "/api/premium/*": {
        price: "$0.10",
        network: "fastset-devnet",
        config: {
          description: "Premium Content Access",
          mimeType: "application/json",
        },
      },
    },
    loggingFacilitator
  )
);

// ─── x402 Payment Middleware - Arbitrum Sepolia Routes ───────────────────────

app.use(
  paymentMiddleware(
    EVM_MERCHANT_ADDRESS,
    {
      "GET /api/arbitrum-service": {
        price: "$0.10",
        network: "arbitrum-sepolia",
        config: {
          description: "AI Agent Premium Service (Arbitrum Sepolia) - Pay per API call",
          mimeType: "application/json",
        },
      },
    },
    loggingFacilitator
  )
);

// ─── Protected Endpoints - FastSet ───────────────────────────────────────────

app.get("/api/fast-service", (req: Request, res: Response) => {
  logStep("✅ DELIVERING FASTSET SERVICE (already settled on-chain)");
  console.log("  Endpoint: /api/fast-service");
  console.log("  Network: fastset-devnet");
  
  res.json({
    success: true,
    message: "🎉 FastSet service delivered successfully!",
    data: {
      timestamp: new Date().toISOString(),
      content: "This is the premium content you paid for via FastSet.",
      tip: "Your payment was verified via FastSet x402 protocol.",
      network: "fastset-devnet",
    },
  });
});

app.get("/api/service", (req: Request, res: Response) => {
  logStep("✅ DELIVERING SERVICE");
  console.log("  Endpoint: /api/service");
  console.log("  Status: 200 OK");
  logSeparator();
  
  res.json({
    success: true,
    message: "🎉 Service delivered successfully!",
    data: {
      timestamp: new Date().toISOString(),
      content: "This is the premium content you paid for.",
      tip: "Your payment was verified via FastSet x402 protocol.",
    },
  });
});

app.get("/api/premium/data", (req: Request, res: Response) => {
  logStep("✅ DELIVERING PREMIUM DATA");
  logSeparator();
  
  res.json({
    success: true,
    message: "Premium data access granted!",
    data: {
      secretKey: "fast-set-rocks-2024",
      insights: ["AI agents can now pay for services", "x402 makes web monetization easy"],
    },
  });
});

// ─── Protected Endpoints - Arbitrum Sepolia ──────────────────────────────────

app.get("/api/arbitrum-service", (req: Request, res: Response) => {
  logStep("📦 PREPARING ARBITRUM RESPONSE (waiting for settle before sending)");
  console.log("  Endpoint: /api/arbitrum-service");
  console.log("  Network: arbitrum-sepolia");
  
  res.json({
    success: true,
    message: "🎉 Arbitrum Sepolia service delivered successfully!",
    data: {
      timestamp: new Date().toISOString(),
      content: "This is the premium content you paid for via Arbitrum Sepolia.",
      tip: "Your payment was verified via EVM x402 protocol with USDC on Arbitrum Sepolia.",
      network: "arbitrum-sepolia",
    },
  });
});

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    merchants: {
      fastset: FASTSET_MERCHANT_ADDRESS,
      arbitrum: EVM_MERCHANT_ADDRESS,
    },
    facilitator: FACILITATOR_URL,
  });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logSeparator();
  logStep("STARTUP - Merchant server started");
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Facilitator: ${FACILITATOR_URL}`);
  console.log("");
  console.log("  Merchant Addresses:");
  console.log(`    FastSet:  ${FASTSET_MERCHANT_ADDRESS}`);
  console.log(`    Arbitrum: ${EVM_MERCHANT_ADDRESS}`);
  console.log("");
  console.log("  Protected Endpoints:");
  console.log("    GET /api/fast-service     → $0.10 USDC (FastSet Devnet)");
  console.log("    GET /api/arbitrum-service → $0.10 USDC (Arbitrum Sepolia)");
  console.log("    GET /api/service          → $0.10 USDC (FastSet - legacy)");
  console.log("    GET /api/premium/*        → $0.10 USDC (FastSet)");
  logSeparator();
  console.log("📡 Ready to accept x402 payments!\n");
});
