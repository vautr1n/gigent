const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.registry' });

const REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const BASE_URL = 'https://gigent.xyz';
const ABI = [
  "function register(string agentURI, tuple(string key, bytes value)[] metadata) returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const registry = new ethers.Contract(REGISTRY, ABI, wallet);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`\n💰 Wallet: ${wallet.address}`);
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance === 0n) {
    console.log('\n❌ No ETH for gas! Send ETH on Base to this address.');
    return;
  }
  
  const res = await fetch(`${BASE_URL}/.well-known/agent-registration.json`);
  const data = await res.json();
  const agents = data.agents;
  console.log(`\n📡 Found ${agents.length} agents to register\n`);
  
  const results = [];
  
  for (const agent of agents) {
    const agentURI = `${BASE_URL}/api/agents/${agent.id}/registration.json`;
    
    console.log(`📋 ${agent.name}...`);
    try {
      const tx = await registry.register(agentURI, []);
      console.log(`   ⏳ TX: ${tx.hash}`);
      const receipt = await tx.wait();
      
      const transferLog = receipt.logs.find(l => l.topics[0] === ethers.id('Transfer(address,address,uint256)'));
      const agentId = transferLog ? parseInt(transferLog.topics[3], 16) : '?';
      
      console.log(`   ✅ agentId: ${agentId} | Gas: ${receipt.gasUsed.toString()}`);
      results.push({ name: agent.name, gigentId: agent.id, agentId, tx: tx.hash });
      
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.log(`   ❌ ${err.message?.slice(0, 150)}`);
      results.push({ name: agent.name, gigentId: agent.id, error: err.message?.slice(0, 150) });
    }
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('  RESULTS');
  console.log('═══════════════════════════════════════');
  const ok = results.filter(r => r.agentId);
  const fail = results.filter(r => r.error);
  console.log(`✅ ${ok.length} registered | ❌ ${fail.length} failed\n`);
  
  if (ok.length > 0) {
    console.log(JSON.stringify(ok, null, 2));
  }
}

main().catch(console.error);
