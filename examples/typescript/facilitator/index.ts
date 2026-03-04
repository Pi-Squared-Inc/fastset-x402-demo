/* eslint-env node */
import { config } from "dotenv";
import express, { Request, Response } from "express";
import { verify, settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  createSigner,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  SupportedFastSetNetworks,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  isSvmSignerWallet,
  type X402Config,
} from "x402/types";

config();

// ─── Logging Helpers ─────────────────────────────────────────────────────────

function logSeparator() {
  console.log("═".repeat(80));
}

function logStep(step: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [FACILITATOR] ${step}`, ...args);
}

function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    "arbitrum-sepolia": `https://sepolia.arbiscan.io/tx/${txHash}`,
    "arbitrum": `https://arbiscan.io/tx/${txHash}`,
    "base-sepolia": `https://sepolia.basescan.org/tx/${txHash}`,
    "base": `https://basescan.org/tx/${txHash}`,
    "ethereum-sepolia": `https://sepolia.etherscan.io/tx/${txHash}`,
    "ethereum": `https://etherscan.io/tx/${txHash}`,
    "fastset-devnet": `https://explorer.fast.xyz/tx/${txHash}`,
    "solana-devnet": `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
  };
  return explorers[network] || `Unknown network: ${network}, txHash: ${txHash}`;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "";
const SVM_PRIVATE_KEY = process.env.SVM_PRIVATE_KEY || "";
const SVM_RPC_URL = process.env.SVM_RPC_URL || "";
const ENABLE_FASTSET = process.env.ENABLE_FASTSET !== "false"; // Enable by default

if (!EVM_PRIVATE_KEY && !SVM_PRIVATE_KEY && !ENABLE_FASTSET) {
  console.error("Missing required environment variables: Need at least one of EVM_PRIVATE_KEY, SVM_PRIVATE_KEY, or ENABLE_FASTSET=true");
  process.exit(1);
}

// Create X402 config with custom RPC URL if provided
const x402Config: X402Config | undefined = SVM_RPC_URL
  ? { svmConfig: { rpcUrl: SVM_RPC_URL } }
  : undefined;

const app = express();

// Configure express to parse JSON bodies
app.use(express.json());

// ─── Request Logging Middleware ──────────────────────────────────────────────

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path !== "/health") {
    logSeparator();
    logStep("INCOMING REQUEST", req.method, req.path);
  }
  next();
});

type VerifyRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

type SettleRequest = {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Verify Endpoint ─────────────────────────────────────────────────────────

app.get("/verify", (req: Request, res: Response) => {
  res.json({
    endpoint: "/verify",
    description: "POST to verify x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

app.post("/verify", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const body: VerifyRequest = req.body;
    
    logStep("VERIFY - Parsing request body...");
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    logStep("VERIFY - Payment Requirements:");
    console.log("  Network:", paymentRequirements.network);
    console.log("  Amount:", paymentRequirements.maxAmountRequired);
    console.log("  PayTo:", paymentRequirements.payTo);
    console.log("  Asset:", paymentRequirements.asset);
    
    logStep("VERIFY - Payment Payload:");
    console.log("  Scheme:", paymentPayload.scheme);
    console.log("  Network:", paymentPayload.network);
    console.log("  Payload type:", typeof paymentPayload.payload);
    if (paymentPayload.payload) {
      const p = paymentPayload.payload as Record<string, unknown>;
      if (p.signature) console.log("  Signature:", (p.signature as string).slice(0, 20) + "...");
      if (p.authorization) {
        const auth = p.authorization as Record<string, unknown>;
        console.log("  Authorization.from:", auth.from);
        console.log("  Authorization.to:", auth.to);
        console.log("  Authorization.value:", auth.value);
        console.log("  Authorization.nonce:", (auth.nonce as string)?.slice(0, 20) + "...");
      }
      if (p.transactionCertificate) console.log("  Has transactionCertificate: true");
    }

    logStep("VERIFY - Creating client for network:", paymentRequirements.network);
    
    // use the correct client/signer based on the requested network
    let client: Signer | ConnectedClient;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      logStep("VERIFY - Using EVM client");
      client = createConnectedClient(paymentRequirements.network);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      logStep("VERIFY - Using SVM signer");
      client = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else if (SupportedFastSetNetworks.includes(paymentRequirements.network as any)) {
      logStep("VERIFY - Using FastSet client");
      client = createConnectedClient(paymentRequirements.network);
    } else {
      throw new Error(`Unsupported network: ${paymentRequirements.network}`);
    }

    logStep("VERIFY - Calling verify()...");
    const valid = await verify(client, paymentPayload, paymentRequirements, x402Config);
    
    logStep("VERIFY - Result:", valid);
    console.log("  Duration:", Date.now() - startTime, "ms");
    
    res.json(valid);
  } catch (error) {
    logStep("VERIFY - ERROR:", error);
    console.log("  Duration:", Date.now() - startTime, "ms");
    res.status(400).json({ error: "Invalid request", details: String(error) });
  }
});

// ─── Settle Endpoint ─────────────────────────────────────────────────────────

app.get("/settle", (req: Request, res: Response) => {
  res.json({
    endpoint: "/settle",
    description: "POST to settle x402 payments",
    body: {
      paymentPayload: "PaymentPayload",
      paymentRequirements: "PaymentRequirements",
    },
  });
});

app.post("/settle", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const body: SettleRequest = req.body;
    
    logStep("SETTLE - Parsing request body...");
    const paymentRequirements = PaymentRequirementsSchema.parse(body.paymentRequirements);
    const paymentPayload = PaymentPayloadSchema.parse(body.paymentPayload);

    logStep("SETTLE - Payment Requirements:");
    console.log("  Network:", paymentRequirements.network);
    console.log("  Amount:", paymentRequirements.maxAmountRequired);
    console.log("  PayTo:", paymentRequirements.payTo);
    console.log("  Asset:", paymentRequirements.asset);
    
    logStep("SETTLE - Payment Payload:");
    console.log("  Scheme:", paymentPayload.scheme);
    console.log("  Network:", paymentPayload.network);
    if (paymentPayload.payload) {
      const p = paymentPayload.payload as Record<string, unknown>;
      if (p.signature) console.log("  Signature:", (p.signature as string).slice(0, 20) + "...");
      if (p.authorization) {
        const auth = p.authorization as Record<string, unknown>;
        console.log("  Authorization.from:", auth.from);
        console.log("  Authorization.to:", auth.to);
        console.log("  Authorization.value:", auth.value);
      }
    }

    logStep("SETTLE - Creating signer for network:", paymentRequirements.network);

    // use the correct private key based on the requested network
    let signer: Signer;
    if (SupportedEVMNetworks.includes(paymentRequirements.network)) {
      logStep("SETTLE - Using EVM signer (will call transferWithAuthorization)");
      signer = await createSigner(paymentRequirements.network, EVM_PRIVATE_KEY);
      console.log("  Signer address:", signer.address);
    } else if (SupportedSVMNetworks.includes(paymentRequirements.network)) {
      logStep("SETTLE - Using SVM signer");
      signer = await createSigner(paymentRequirements.network, SVM_PRIVATE_KEY);
    } else if (SupportedFastSetNetworks.includes(paymentRequirements.network as any)) {
      logStep("SETTLE - FastSet (already settled on-chain, no action needed)");
      signer = { address: "", network: paymentRequirements.network } as Signer;
    } else {
      throw new Error(`Unsupported network: ${paymentRequirements.network}`);
    }

    logStep("SETTLE - Calling settle()...");
    const response = await settle(signer, paymentPayload, paymentRequirements, x402Config);
    
    logStep("SETTLE - Result:");
    console.log("  Success:", response.success);
    // EVM settle returns 'transaction' (string txHash), FastSet returns object or nothing
    let txHash: string | undefined;
    const rawTx = (response as any).transaction;
    if (typeof rawTx === 'string' && rawTx.startsWith('0x')) {
      txHash = rawTx;
    }
    if (txHash) {
      console.log("  TxHash:", txHash);
      console.log("  Explorer:", getExplorerUrl(paymentRequirements.network, txHash));
    }
    if (response.network) console.log("  Network:", response.network);
    if (response.payer) console.log("  Payer:", response.payer);
    console.log("  Duration:", Date.now() - startTime, "ms");
    
    // Normalize response to always include txHash field for EVM
    const normalizedResponse = txHash ? { ...response, txHash } : response;
    res.json(normalizedResponse);
  } catch (error) {
    logStep("SETTLE - ERROR:", error);
    console.log("  Duration:", Date.now() - startTime, "ms");
    res.status(400).json({ error: `Settlement failed: ${error}` });
  }
});

// ─── Supported Endpoint ──────────────────────────────────────────────────────

app.get("/supported", async (req: Request, res: Response) => {
  logStep("SUPPORTED - Listing supported payment kinds...");
  
  let kinds: SupportedPaymentKind[] = [];

  // evm - support both Base Sepolia and Arbitrum Sepolia
  if (EVM_PRIVATE_KEY) {
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
    });
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "arbitrum-sepolia",
    });
    logStep("SUPPORTED - Added EVM networks: base-sepolia, arbitrum-sepolia");
  }

  // svm
  if (SVM_PRIVATE_KEY) {
    const signer = await createSigner("solana-devnet", SVM_PRIVATE_KEY);
    const feePayer = isSvmSignerWallet(signer) ? signer.address : undefined;

    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "solana-devnet",
      extra: {
        feePayer,
      },
    });
    logStep("SUPPORTED - Added SVM network: solana-devnet");
  }

  // fastset - no private key needed, transactions are already settled on-chain
  if (ENABLE_FASTSET) {
    kinds.push({
      x402Version: 1,
      scheme: "exact",
      network: "fastset-devnet",
    });
    logStep("SUPPORTED - Added FastSet network: fastset-devnet");
  }

  res.json({ kinds });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  logSeparator();
  logStep("STARTUP - Facilitator server started");
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  EVM_PRIVATE_KEY: ${EVM_PRIVATE_KEY ? "✓ configured" : "✗ not set"}`);
  console.log(`  SVM_PRIVATE_KEY: ${SVM_PRIVATE_KEY ? "✓ configured" : "✗ not set"}`);
  console.log(`  ENABLE_FASTSET: ${ENABLE_FASTSET ? "✓ enabled" : "✗ disabled"}`);
  if (EVM_PRIVATE_KEY) {
    // Derive address from private key for logging
    try {
      const pk = EVM_PRIVATE_KEY.startsWith("0x") ? EVM_PRIVATE_KEY : `0x${EVM_PRIVATE_KEY}`;
      const signer = await createSigner("arbitrum-sepolia", pk);
      console.log(`  EVM Signer Address: ${signer.address}`);
    } catch (e) {
      console.log(`  EVM Signer Address: (failed to derive)`);
    }
  }
  logSeparator();
});
