// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PaymentEscrow — USDC escrow for Gigent orders
/// @notice Buyers deposit USDC via createJob; platform releases or refunds
contract PaymentEscrow is Ownable {
    using SafeERC20 for IERC20;

    enum JobStatus { None, Active, Released, Refunded }

    struct Job {
        address buyer;
        address seller;
        uint256 amount;
        JobStatus status;
    }

    IERC20 public immutable usdc;
    mapping(bytes32 => Job) private _jobs;

    event JobCreated(bytes32 indexed jobId, address buyer, address seller, uint256 amount);
    event JobReleased(bytes32 indexed jobId, address seller, uint256 amount);
    event JobRefunded(bytes32 indexed jobId, address buyer, uint256 amount);

    constructor(address usdcAddress) Ownable(msg.sender) {
        require(usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(usdcAddress);
    }

    /// @notice Create escrow job — buyer must approve this contract first
    /// @param jobId keccak256 of the order UUID
    /// @param seller The seller's wallet address
    /// @param amount USDC amount (6 decimals)
    function createJob(bytes32 jobId, address seller, uint256 amount) external {
        require(_jobs[jobId].status == JobStatus.None, "Job already exists");
        require(seller != address(0), "Invalid seller");
        require(amount > 0, "Amount must be > 0");
        require(seller != msg.sender, "Seller cannot be buyer");

        _jobs[jobId] = Job({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            status: JobStatus.Active
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit JobCreated(jobId, msg.sender, seller, amount);
    }

    /// @notice Release escrowed funds to seller (platform only)
    function releaseJob(bytes32 jobId) external onlyOwner {
        Job storage job = _jobs[jobId];
        require(job.status == JobStatus.Active, "Job not active");

        job.status = JobStatus.Released;
        usdc.safeTransfer(job.seller, job.amount);

        emit JobReleased(jobId, job.seller, job.amount);
    }

    /// @notice Refund escrowed funds to buyer (platform only)
    function refundJob(bytes32 jobId) external onlyOwner {
        Job storage job = _jobs[jobId];
        require(job.status == JobStatus.Active, "Job not active");

        job.status = JobStatus.Refunded;
        usdc.safeTransfer(job.buyer, job.amount);

        emit JobRefunded(jobId, job.buyer, job.amount);
    }

    /// @notice Get job details
    function getJob(bytes32 jobId)
        external
        view
        returns (address buyer, address seller, uint256 amount, JobStatus status)
    {
        Job storage job = _jobs[jobId];
        return (job.buyer, job.seller, job.amount, job.status);
    }
}
