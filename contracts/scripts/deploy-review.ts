import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("=".repeat(60));
  console.log("Gigent — Deploy ReviewSystem Only");
  console.log("=".repeat(60));
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Chain ID:  ${chainId}`);
  console.log(`Network:   ${chainId === 8453 ? "Base Mainnet" : "Base Sepolia"}`);
  console.log("");

  // Check nonce
  const nonce = await ethers.provider.getTransactionCount(deployer.address, "latest");
  console.log(`Current nonce: ${nonce}`);
  console.log("");

  // Deploy ReviewSystem
  console.log("Deploying ReviewSystem...");
  const ReviewSystem = await ethers.getContractFactory("ReviewSystem");
  const reviewSystem = await ReviewSystem.deploy();
  await reviewSystem.waitForDeployment();
  const reviewAddr = await reviewSystem.getAddress();
  console.log(`  ReviewSystem:   ${reviewAddr}`);

  console.log("");
  console.log("=".repeat(60));
  console.log("Add this to your backend .env:");
  console.log("=".repeat(60));
  console.log(`REVIEW_CONTRACT=${reviewAddr}`);

  const explorer = chainId === 8453
    ? "https://basescan.org"
    : "https://sepolia.basescan.org";
  console.log(`Verify: ${explorer}/address/${reviewAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
