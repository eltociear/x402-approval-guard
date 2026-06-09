#!/usr/bin/env node
// x402-approval-guard — refuse dangerous ERC20 approvals before your agent signs them.
//
// Before an AI agent signs `approve(spender, amount)`, it should ask: is this spender
// already over-approved? Is `amount` effectively unlimited? Unlimited approvals are the
// #1 wallet-drain vector. This guard answers that in one x402 call to `contract-guard`
// (https://eltociear-contract-guard.hf.space), pay-per-use ($0.005 USDC on Base), then
// lets you BLOCK the approval if it's risky.
//
// Usage:
//   X402_PAYER_KEY=0x...  node index.mjs <token> <owner> <spender> [chain]
//   (the payer key signs the $0.005 x402 micropayment; Base USDC)
//
// Library:
//   import { checkApproval, guardApprove } from 'x402-approval-guard'
//
// Prefer zero-cost? The same engine is a free MCP server: io.github.eltociear/contract-guard-mcp
// (official MCP Registry). Use the x402 HTTP path for server-side / no-install agents.

import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';

const ENDPOINT = process.env.CONTRACT_GUARD_URL || 'https://eltociear-contract-guard.hf.space/check';

/** Call contract-guard's check_approval over x402. Returns the risk verdict. */
export async function checkApproval({ token, owner, spender, chain = 'base', payerKey }) {
  const account = privateKeyToAccount(payerKey.startsWith('0x') ? payerKey : '0x' + payerKey);
  const fetchWithPay = wrapFetchWithPayment(fetch, account);
  const res = await fetchWithPay(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // contract-guard exposes check_approval via the same /check route's tool surface;
    // pass the approval triple. (token/owner/spender → allowance + unlimited flag + risk)
    body: JSON.stringify({ address: token, owner, spender, chain, tool: 'check_approval' }),
  });
  if (!res.ok) throw new Error(`contract-guard ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Guarded approve: returns { allow, verdict }. allow=false when the existing/!intended
 * allowance is unlimited or otherwise HIGH/CRITICAL risk. Wire this in front of approve().
 */
export async function guardApprove(opts) {
  const verdict = await checkApproval(opts);
  const level = (verdict.risk_level || verdict.riskLevel || 'OK').toUpperCase();
  const unlimited = verdict.unlimited === true;
  const allow = !unlimited && !['HIGH', 'CRITICAL'].includes(level);
  return { allow, verdict };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [token, owner, spender, chain = 'base'] = process.argv.slice(2);
  const payerKey = process.env.X402_PAYER_KEY;
  if (!token || !owner || !spender || !payerKey) {
    console.error('usage: X402_PAYER_KEY=0x.. node index.mjs <token> <owner> <spender> [chain]');
    process.exit(1);
  }
  const { allow, verdict } = await guardApprove({ token, owner, spender, chain, payerKey });
  console.log(JSON.stringify(verdict, null, 2));
  console.log(allow ? '\n✅ ALLOW — approval looks safe' : '\n🛑 BLOCK — dangerous/unlimited allowance, do NOT sign approve()');
  process.exit(allow ? 0 : 2);
}
