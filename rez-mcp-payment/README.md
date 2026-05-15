# REZ Payment MCP Server

MCP server for debugging and inspecting REZ payment system transactions.

## Features

- List transactions with filtering
- Get transaction details
- Check payment status
- List refunds
- Initiate refunds
- Get wallet balances

## Installation

```bash
cd rez-mcp-payment
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_transactions` | List transactions with optional filters |
| `get_transaction` | Get detailed information about a specific transaction |
| `get_payment_status` | Get the current status of a payment |
| `list_refunds` | List refunds with optional filters |
| `initiate_refund` | Initiate a refund for a transaction |
| `get_wallet_balance` | Get wallet balance for a user |

## Usage

Configure Claude Code to use this MCP server by adding to your settings:

```json
{
  "mcpServers": {
    "rez-payment": {
      "command": "node",
      "args": ["/path/to/rez-mcp-payment/dist/index.js"]
    }
  }
}
```
