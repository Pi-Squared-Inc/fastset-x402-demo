# x402-next Example App

This is a Next.js application that demonstrates how to use the `x402-next` middleware to implement paywall functionality in your Next.js routes.

## Prerequisites

- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))
- A wallet address for receiving payments:
  - **FastSet**: Bech32 address (e.g., `set1...`)
  - **Solana**: Base58 address (e.g., `GS7Un...`)
  - **EVM**: Ethereum address (e.g., `0x...`)

## Setup

1. Copy `.env.sample` to `.env.local` and configure your network and wallet address:

```bash
cp .env.sample .env.local
```

The default configuration uses **FastSet Devnet**:
```bash
NETWORK=fastset-devnet
RESOURCE_WALLET_ADDRESS=set1eg4ld9jp02rae5uyshusvmw0xszg24uffe60m7aspc2jkvjgfxjsd5wh0q
```

You can also use:
- **Solana Devnet**: Change `NETWORK=solana-devnet` and use a Solana address
- **Base Sepolia**: Change `NETWORK=base-sepolia` and use an Ethereum address

2. Install and build all packages from the typescript examples root:
```bash
cd ../../
pnpm install
pnpm build
cd fullstack/next
```

3. Install and start the Next.js example:
```bash
pnpm dev
```

## Wallet Setup

### FastSet Wallet (Browser Extension)

To use FastSet for payments:

1. Install the FastSet browser extension (Chrome/Brave/Edge)
2. Create or import a FastSet wallet
3. Get devnet tokens from the FastSet faucet
4. Visit `http://localhost:3000/protected` and connect your wallet

**FastSet Configuration**:
- Network: `fastset-devnet`
- Native Token: SET (0xfa575e7000000000000000000000000000000000000000000000000000000000)
- Payment Amount: $0.01 (automatically converted to SET tokens)

### Solana Wallet (Phantom, Solflare, etc.)

1. Install a Solana wallet extension
2. Switch to Devnet in wallet settings
3. Get devnet SOL from https://faucet.solana.com/
4. Visit the protected route and connect your wallet

### EVM Wallet (MetaMask, Coinbase Wallet, etc.)

1. Install an EVM-compatible wallet
2. Add Base Sepolia testnet to your wallet
3. Get testnet ETH from Base Sepolia faucet
4. Visit the protected route and connect your wallet

## Example Routes

The app includes protected routes that require payment to access:

### Protected Page Route
The `/protected` route requires a payment of $0.01 to access. The route is protected using the x402-next middleware:

```typescript
// middleware.ts
import { paymentMiddleware, Network, Resource } from "x402-next";

const facilitatorUrl = process.env.NEXT_PUBLIC_FACILITATOR_URL as Resource;
const payTo = process.env.RESOURCE_WALLET_ADDRESS as Address;
const network = process.env.NETWORK as Network;

export const middleware = paymentMiddleware(
  payTo,
  {
    "/protected": {
      price: "$0.01",
      network,
      config: {
        description: "Access to protected content",
      },
    },
  },
  {
    url: facilitatorUrl,
  },
);

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*"],
};
```

## Response Format

### Payment Required (402)
```json
{
  "error": "X-PAYMENT header is required",
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base",
    "maxAmountRequired": "1000",
    "resource": "http://localhost:3000/protected",
    "description": "Access to protected content",
    "mimeType": "",
    "payTo": "0xYourAddress",
    "maxTimeoutSeconds": 60,
    "asset": "0x...",
    "outputSchema": null,
    "extra": null
  }
}
```

### Successful Response
```ts
// Headers
{
  "X-PAYMENT-RESPONSE": "..." // Encoded response object
}
```

## Extending the Example

To add more protected routes, update the middleware configuration:

```typescript
export const middleware = paymentMiddleware(
  payTo,
  {
    "/protected": {
      price: "$0.01",
      network,
      config: {
        description: "Access to protected content",
      },
    },
    "/api/premium": {
      price: "$0.10",
      network,
      config: {
        description: "Premium API access",
      },
    },
  }
);

export const config = {
  matcher: ["/protected/:path*", "/api/premium/:path*"],
};
```
