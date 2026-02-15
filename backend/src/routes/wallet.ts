import { Router } from 'express';
import { getDb } from '../db/setup';
import { getBalance, sendUSDC, getChainInfo, explorerUrl } from '../services/wallet';
import { sendUSDCFromSmartAccount } from '../services/smart-account';
import { decrypt, isEncrypted } from '../services/crypto';

export const walletRoutes = Router();

// ─── Get wallet balance for an agent ───
walletRoutes.get('/:agent_id/balance', async (req, res) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT wallet_address FROM agents WHERE id = ?').get(req.params.agent_id) as any;
    db.close();

    if (!agent || !agent.wallet_address) {
      return res.status(404).json({ error: 'Agent or wallet not found' });
    }

    const balance = await getBalance(agent.wallet_address);
    res.json(balance);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get wallet address for an agent ───
walletRoutes.get('/:agent_id', (req, res) => {
  const db = getDb();
  const agent = db.prepare('SELECT id, name, wallet_address FROM agents WHERE id = ?').get(req.params.agent_id) as any;
  db.close();

  if (!agent || !agent.wallet_address) {
    return res.status(404).json({ error: 'Agent or wallet not found' });
  }

  res.json({
    agent_id: agent.id,
    agent_name: agent.name,
    wallet_address: agent.wallet_address,
    explorer: explorerUrl(agent.wallet_address, 'address'),
  });
});

// ─── Send USDC from one agent to another ───
walletRoutes.post('/send', async (req, res) => {
  try {
    const { from_agent_id, to_agent_id, amount } = req.body;

    if (!from_agent_id || !to_agent_id || !amount) {
      return res.status(400).json({ error: 'Required: from_agent_id, to_agent_id, amount' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const db = getDb();
    const sender = db.prepare('SELECT * FROM agents WHERE id = ?').get(from_agent_id) as any;
    const receiver = db.prepare('SELECT * FROM agents WHERE id = ?').get(to_agent_id) as any;
    db.close();

    if (!sender?.private_key) return res.status(400).json({ error: 'Sender has no wallet' });
    if (!receiver?.wallet_address) return res.status(400).json({ error: 'Receiver has no wallet' });

    // Decrypt private key (fixes bug: was passing encrypted key directly)
    const senderKey = isEncrypted(sender.private_key) ? decrypt(sender.private_key) : sender.private_key;

    let result;
    if (sender.account_type === 'smart_account') {
      result = await sendUSDCFromSmartAccount(senderKey, receiver.wallet_address, amount);
    } else {
      result = await sendUSDC(senderKey, receiver.wallet_address, amount);
    }

    console.log(`💸 ${sender.name} sent $${amount} USDC to ${receiver.name} | tx: ${result.txHash}`);
    res.json({
      success: true,
      ...result,
      from_agent: sender.name,
      to_agent: receiver.name,
      amount_usdc: amount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Chain info ───
walletRoutes.get('/', (_req, res) => {
  res.json(getChainInfo());
});
