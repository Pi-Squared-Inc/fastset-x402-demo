# FastSet x402 Merchant Demo

A demo merchant server that accepts FastSet payments via the x402 protocol.

## Overview

This example demonstrates how to use the `x402-express` middleware to protect API endpoints with FastSet payments. When an AI agent (or any client) requests a protected resource, they must:

1. Receive a `402 Payment Required` response with payment requirements
2. Pay the required amount in fastUSDC on FastSet
3. Retry the request with a `X-PAYMENT` header containing the transaction certificate
4. Receive the protected content after payment verification

## Setup

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your merchant FastSet address

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Start the facilitator (in another terminal):
   ```bash
   cd ../facilitator
   pnpm dev
   ```

5. Start the merchant server:
   ```bash
   pnpm dev
   ```

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/service` | $0.01 fastUSDC | AI Agent Premium Service |
| `GET /api/premium/*` | $0.05 fastUSDC | Premium Content Access |
| `GET /health` | Free | Health check |

## Demo Flow

### 1. Request without payment (get 402)

```bash
curl http://localhost:3001/api/service
```

Response:
```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "fastset-devnet",
      "maxAmountRequired": "10000",
      "payTo": "set16h3jkg5sv9ng2hwcjz08w3x2qvhxnzk5sw5awkqkgwrg3kv4hd7qkttx8g",
      "asset": "HnRJAAIRgrKTU4u2aFt33wleNRNk1VACFhTOkMirngo="
    }
  ]
}
```

### 2. AI Agent pays and retries

The AI agent:
1. Parses the payment requirements
2. Sends payment on FastSet using the money skill
3. Gets the TransactionCertificate
4. Retries with `X-PAYMENT` header containing the encoded certificate

### 3. Successful response

```json
{
  "success": true,
  "message": "🎉 Service delivered successfully!",
  "data": {
    "timestamp": "2024-03-03T05:30:00.000Z",
    "content": "This is the premium content you paid for.",
    "tip": "Your payment was verified via FastSet x402 protocol."
  }
}
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Agent      │     │   Merchant      │     │   Facilitator   │
│   (Buyer)       │     │   (port 3001)   │     │   (port 3002)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. GET /api/service   │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │ 2. 402 Payment Required                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 3. Pay on FastSet     │                       │
         │───────────────────────┼───────────────────────┼──> FastSet
         │                       │                       │
         │ 4. GET /api/service   │                       │
         │    + X-PAYMENT header │                       │
         │──────────────────────>│                       │
         │                       │ 5. Verify payment     │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │ 6. Valid ✓            │
         │                       │<──────────────────────│
         │                       │                       │
         │ 7. 200 OK + Content   │                       │
         │<──────────────────────│                       │
         │                       │                       │
```

## Token Configuration

- **Asset**: fastUSDC
- **Token ID**: `HnRJAAIRgrKTU4u2aFt33wleNRNk1VACFhTOkMirngo=`
- **Decimals**: 6
- **Network**: `fastset-devnet`
- **RPC**: `https://api.fast.xyz/proxy`
