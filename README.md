# x402-approval-guard

**Stop your AI agent from signing dangerous ERC20 approvals.**

Unlimited / over-broad token approvals are the **#1 wallet-drain vector**. Before your
agent signs `approve(spender, amount)`, it should ask: *is this spender already
over-approved? Is `amount` effectively unlimited? Is the spender a risky contract?*

`x402-approval-guard` answers that in **one [x402](https://x402.org) call** to
[`contract-guard`](https://eltociear-contract-guard.hf.space) — pay-per-use,
**$0.005 USDC on Base**, no signup — then lets your agent **block** the approval if it's risky.

```js
import { guardApprove } from 'x402-approval-guard';

const { allow, verdict } = await guardApprove({
  token:   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  owner:   myAgentWallet,
  spender: routerAddress,
  chain:   'base',
  payerKey: process.env.X402_PAYER_KEY,   // signs the $0.005 micropayment
});

if (!allow) throw new Error(`Refusing approve(): ${verdict.summary}`);
await wallet.writeContract({ /* approve(spender, amount) */ });
```

CLI:

```bash
X402_PAYER_KEY=0x... npx x402-approval-guard <token> <owner> <spender> [base|ethereum]
# 🛑 BLOCK — dangerous/unlimited allowance, do NOT sign approve()
```

## Why x402?

No API keys, no accounts, no subscriptions. Your agent's wallet pays $0.005 per check via
the [x402 protocol](https://x402.org) (USDC on Base, Dexter facilitator, 0% fee). The
check is a single HTTP request that returns `402 Payment Required`, your client pays, and
retries — handled here by [`x402-fetch`](https://www.npmjs.com/package/x402-fetch).

## What `contract-guard` returns

`check_approval(token, owner, spender)` →

| field | meaning |
|---|---|
| `unlimited` | spender is approved for an effectively-infinite amount |
| `allowance` / `allowance_raw` | current human / raw allowance |
| `risk_level` | `OK` / `MEDIUM` / `HIGH` |
| `flags` | actionable explanation (e.g. *"UNLIMITED approval — spender can move ALL of this token"*) |

`contract-guard` also exposes `check_contract` (upgradeable-proxy / EIP-7702 / ERC20
metadata risk). Same engine is a **free MCP server** —
[`io.github.eltociear/contract-guard-mcp`](https://github.com/eltociear/contract-guard-mcp)
in the official [MCP Registry](https://registry.modelcontextprotocol.io) + Smithery — if
you'd rather run it locally for zero cost. Use the x402 HTTP endpoint for server-side /
no-install agents.

## Install

```bash
npm install x402-approval-guard   # or: npm install viem x402-fetch
```

MIT licensed. Built as an [awesome-x402](https://github.com/Merit-Systems/awesome-x402)
example app.
