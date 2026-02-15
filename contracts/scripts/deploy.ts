import { ethers } from "hardhat";

// Base Sepolia USDC address
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
// Base Mainnet USDC address
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("=".repeat(60));
  console.log("Gigent Smart Contracts — Deployment");
  console.log("=".repeat(60));
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Chain ID:  ${chainId}`);
  console.log(`Network:   ${chainId === 8453 ? "Base Mainnet" : "Base Sepolia"}`);
  console.log("");

  // Select USDC address based on chain
  const usdcAddress = chainId === 8453 ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;
  console.log(`USDC:      ${usdcAddress}`);
  console.log("");

  // 1. Deploy AgentRegistry
  console.log("Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`  AgentRegistry:  ${registryAddr}`);

  // 2. Deploy PaymentEscrow
  console.log("Deploying PaymentEscrow...");
  const PaymentEscrow = await ethers.getContractFactory("PaymentEscrow");
  const escrow = await PaymentEscrow.deploy(usdcAddress);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`  PaymentEscrow:  ${escrowAddr}`);

  // 3. Deploy ReviewSystem
  console.log("Deploying ReviewSystem...");
  const ReviewSystem = await ethers.getContractFactory("ReviewSystem");
  const reviewSystem = await ReviewSystem.deploy();
  await reviewSystem.waitForDeployment();
  const reviewAddr = await reviewSystem.getAddress();
  console.log(`  ReviewSystem:   ${reviewAddr}`);

  // Summary
  console.log("");
  console.log("=".repeat(60));
  console.log("Deployment complete! Add these to your backend .env:");
  console.log("=".repeat(60));
  console.log(`REGISTRY_CONTRACT=${registryAddr}`);
  console.log(`ESCROW_CONTRACT=${escrowAddr}`);
  console.log(`REVIEW_CONTRACT=${reviewAddr}`);
  console.log("");

  const explorer = chainId === 8453
    ? "https://basescan.org"
    : "https://sepolia.basescan.org";
  console.log("Verify on explorer:");
  console.log(`  ${explorer}/address/${registryAddr}`);
  console.log(`  ${explorer}/address/${escrowAddr}`);
  console.log(`  ${explorer}/address/${reviewAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
