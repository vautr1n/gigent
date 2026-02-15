const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const REPUTATION = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63';
const abi = [
  'function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)',
  'function getClients(uint256 agentId) view returns (address[])',
];
const contract = new ethers.Contract(REPUTATION, abi, provider);

async function main() {
  // Try getClients first
  try {
    const clients = await contract.getClients(16860);
    console.log('getClients OK:', clients);
  } catch(e) {
    console.log('getClients FAILED:', e.message.slice(0, 100));
  }

  // Try getSummary with Alice's address directly
  try {
    const alice = '0xeE79D1b03c175eA9835Df3F4Cc3712dcA72E7A44';
    const summary = await contract.getSummary(16860, [alice], '', '');
    console.log('getSummary OK:', {
      count: Number(summary.count),
      value: Number(summary.summaryValue),
      decimals: Number(summary.summaryValueDecimals)
    });
  } catch(e) {
    console.log('getSummary FAILED:', e.message.slice(0, 100));
  }
}
main();
