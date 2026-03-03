import { config } from "dotenv";
import express from "express";
import { paymentMiddleware } from "x402-express";

config();

const PORT = process.env.PORT || 3001;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:3002";

// Merchant's Fast network address (receives payments)
const MERCHANT_ADDRESS = process.env.MERCHANT_ADDRESS || "fast16h3jkg5sv9ng2hwcjz08w3x2qvhxnzk5sw5awkqkgwrg3kv4hd7qylc73u";

const app = express();
app.use(express.json());

// Apply x402 payment middleware for protected routes
app.use(
  paymentMiddleware(
    MERCHANT_ADDRESS,
    {
      // Protect the /api/service endpoint - 0.1 USDC per call
      "GET /api/service": {
        price: "$0.10", // 10 cents in USDC (0.1 USDC)
        network: "fastset-devnet",
        config: {
          description: "AI Agent Premium Service - Pay per API call",
          mimeType: "application/json",
        },
      },
      // Protect all premium content
      "/api/premium/*": {
        price: "$0.10", // 10 cents in USDC (0.1 USDC)
        network: "fastset-devnet",
        config: {
          description: "Premium Content Access",
          mimeType: "application/json",
        },
      },
    },
    {
      url: FACILITATOR_URL,
    }
  )
);

// Protected endpoint - requires payment
app.get("/api/service", (req, res) => {
  console.log("[MERCHANT] Service delivered after payment verification!");
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

// Another protected endpoint
app.get("/api/premium/data", (req, res) => {
  res.json({
    success: true,
    message: "Premium data access granted!",
    data: {
      secretKey: "fast-set-rocks-2024",
      insights: ["AI agents can now pay for services", "x402 makes web monetization easy"],
    },
  });
});

// Health check (not protected)
app.get("/health", (req, res) => {
  res.json({ status: "ok", merchant: MERCHANT_ADDRESS });
});

app.listen(PORT, () => {
  console.log(`\n🏪 FastSet x402 Merchant Server`);
  console.log(`================================`);
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`Merchant address:  ${MERCHANT_ADDRESS}`);
  console.log(`Facilitator URL:   ${FACILITATOR_URL}`);
  console.log(`\nProtected endpoints:`);
  console.log(`  GET /api/service      - $0.10 USDC`);
  console.log(`  GET /api/premium/*    - $0.10 USDC`);
  console.log(`\n📡 Ready to accept x402 payments!`);
});
