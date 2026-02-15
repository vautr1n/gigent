import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("PaymentEscrow", function () {
  async function deployFixture() {
    const [owner, buyer, seller, other] = await ethers.getSigners();

    // Deploy mock USDC (standard ERC20 with 6 decimals)
    const MockERC20 = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockERC20.deploy();

    // Deploy PaymentEscrow
    const PaymentEscrow = await ethers.getContractFactory("PaymentEscrow");
    const escrow = await PaymentEscrow.deploy(await usdc.getAddress());

    // Mint USDC to buyer (1000 USDC)
    const amount = ethers.parseUnits("1000", 6);
    await usdc.mint(buyer.address, amount);

    return { escrow, usdc, owner, buyer, seller, other, amount };
  }

  describe("createJob", function () {
    it("should create a job and transfer USDC to escrow", async function () {
      const { escrow, usdc, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      // Buyer approves escrow
      await usdc.connect(buyer).approve(await escrow.getAddress(), price);

      // Create job
      await expect(escrow.connect(buyer).createJob(jobId, seller.address, price))
        .to.emit(escrow, "JobCreated")
        .withArgs(jobId, buyer.address, seller.address, price);

      // Verify escrow holds the funds
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(price);

      // Verify job details
      const job = await escrow.getJob(jobId);
      expect(job.buyer).to.equal(buyer.address);
      expect(job.seller).to.equal(seller.address);
      expect(job.amount).to.equal(price);
      expect(job.status).to.equal(1); // Active
    });

    it("should revert if job already exists", async function () {
      const { escrow, usdc, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price * 2n);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);

      await expect(
        escrow.connect(buyer).createJob(jobId, seller.address, price)
      ).to.be.revertedWith("Job already exists");
    });

    it("should revert if seller is zero address", async function () {
      const { escrow, usdc, buyer } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);

      await expect(
        escrow.connect(buyer).createJob(jobId, ethers.ZeroAddress, price)
      ).to.be.revertedWith("Invalid seller");
    });

    it("should revert if amount is 0", async function () {
      const { escrow, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));

      await expect(
        escrow.connect(buyer).createJob(jobId, seller.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("releaseJob", function () {
    it("should release funds to seller", async function () {
      const { escrow, usdc, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);

      const sellerBefore = await usdc.balanceOf(seller.address);

      await expect(escrow.releaseJob(jobId))
        .to.emit(escrow, "JobReleased")
        .withArgs(jobId, seller.address, price);

      expect(await usdc.balanceOf(seller.address)).to.equal(sellerBefore + price);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);

      // Verify status
      const job = await escrow.getJob(jobId);
      expect(job.status).to.equal(2); // Released
    });

    it("should revert if called by non-owner", async function () {
      const { escrow, usdc, buyer, seller, other } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);

      await expect(
        escrow.connect(other).releaseJob(jobId)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should revert on double release", async function () {
      const { escrow, usdc, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);
      await escrow.releaseJob(jobId);

      await expect(escrow.releaseJob(jobId)).to.be.revertedWith("Job not active");
    });
  });

  describe("refundJob", function () {
    it("should refund funds to buyer", async function () {
      const { escrow, usdc, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);

      const buyerBefore = await usdc.balanceOf(buyer.address);

      await expect(escrow.refundJob(jobId))
        .to.emit(escrow, "JobRefunded")
        .withArgs(jobId, buyer.address, price);

      expect(await usdc.balanceOf(buyer.address)).to.equal(buyerBefore + price);

      // Verify status
      const job = await escrow.getJob(jobId);
      expect(job.status).to.equal(3); // Refunded
    });

    it("should revert if called by non-owner", async function () {
      const { escrow, usdc, buyer, seller, other } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);

      await expect(
        escrow.connect(other).refundJob(jobId)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should revert if already released", async function () {
      const { escrow, usdc, buyer, seller } = await loadFixture(deployFixture);
      const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));
      const price = ethers.parseUnits("100", 6);

      await usdc.connect(buyer).approve(await escrow.getAddress(), price);
      await escrow.connect(buyer).createJob(jobId, seller.address, price);
      await escrow.releaseJob(jobId);

      await expect(escrow.refundJob(jobId)).to.be.revertedWith("Job not active");
    });
  });
});

describe("AgentRegistry", function () {
  async function deployFixture() {
    const [owner, other] = await ethers.getSigners();
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.deploy();
    return { registry, owner, other };
  }

  it("should register an agent", async function () {
    const { registry, owner, other } = await loadFixture(deployFixture);
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-uuid-1"));

    await expect(registry.registerAgent(agentId, other.address, owner.address))
      .to.emit(registry, "AgentRegistered")
      .withArgs(agentId, other.address, owner.address);

    expect(await registry.isRegistered(agentId)).to.be.true;

    const agent = await registry.getAgent(agentId);
    expect(agent.wallet).to.equal(other.address);
    expect(agent.active).to.be.true;
  });

  it("should deactivate an agent", async function () {
    const { registry, owner, other } = await loadFixture(deployFixture);
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-uuid-1"));

    await registry.registerAgent(agentId, other.address, owner.address);
    await registry.deactivateAgent(agentId);

    expect(await registry.isRegistered(agentId)).to.be.false;
  });

  it("should revert register from non-owner", async function () {
    const { registry, other } = await loadFixture(deployFixture);
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-uuid-1"));

    await expect(
      registry.connect(other).registerAgent(agentId, other.address, other.address)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });
});

describe("ReviewSystem", function () {
  async function deployFixture() {
    const [owner, reviewer, reviewed, other] = await ethers.getSigners();
    const ReviewSystem = await ethers.getContractFactory("ReviewSystem");
    const reviews = await ReviewSystem.deploy();
    return { reviews, owner, reviewer, reviewed, other };
  }

  it("should submit a review", async function () {
    const { reviews, reviewer, reviewed } = await loadFixture(deployFixture);
    const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));

    await expect(reviews.submitReview(jobId, reviewer.address, reviewed.address, 5))
      .to.emit(reviews, "ReviewSubmitted")
      .withArgs(jobId, reviewer.address, reviewed.address, 5);

    const review = await reviews.getReview(jobId);
    expect(review.rating).to.equal(5);
    expect(review.reviewer).to.equal(reviewer.address);
  });

  it("should track average rating", async function () {
    const { reviews, reviewer, reviewed } = await loadFixture(deployFixture);

    await reviews.submitReview(
      ethers.keccak256(ethers.toUtf8Bytes("order-1")),
      reviewer.address, reviewed.address, 5
    );
    await reviews.submitReview(
      ethers.keccak256(ethers.toUtf8Bytes("order-2")),
      reviewer.address, reviewed.address, 3
    );

    const [sum, count] = await reviews.getAverageRating(reviewed.address);
    expect(sum).to.equal(8);
    expect(count).to.equal(2);
    expect(await reviews.getReviewCount(reviewed.address)).to.equal(2);
  });

  it("should revert invalid rating", async function () {
    const { reviews, reviewer, reviewed } = await loadFixture(deployFixture);
    const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));

    await expect(
      reviews.submitReview(jobId, reviewer.address, reviewed.address, 0)
    ).to.be.revertedWith("Rating must be 1-5");

    await expect(
      reviews.submitReview(jobId, reviewer.address, reviewed.address, 6)
    ).to.be.revertedWith("Rating must be 1-5");
  });

  it("should revert duplicate review", async function () {
    const { reviews, reviewer, reviewed } = await loadFixture(deployFixture);
    const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));

    await reviews.submitReview(jobId, reviewer.address, reviewed.address, 4);
    await expect(
      reviews.submitReview(jobId, reviewer.address, reviewed.address, 5)
    ).to.be.revertedWith("Review already exists");
  });

  it("should revert from non-owner", async function () {
    const { reviews, reviewer, reviewed, other } = await loadFixture(deployFixture);
    const jobId = ethers.keccak256(ethers.toUtf8Bytes("order-1"));

    await expect(
      reviews.connect(other).submitReview(jobId, reviewer.address, reviewed.address, 4)
    ).to.be.revertedWithCustomError(reviews, "OwnableUnauthorizedAccount");
  });
});
