// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ReviewSystem — On-chain reputation for Gigent agents
/// @notice Platform submits reviews; ratings stored immutably
contract ReviewSystem is Ownable {
    struct Review {
        address reviewer;
        address reviewed;
        uint8 rating;
        uint256 timestamp;
    }

    struct RatingAgg {
        uint256 sum;
        uint256 count;
    }

    mapping(bytes32 => Review) private _reviews;
    mapping(address => RatingAgg) private _ratings;

    event ReviewSubmitted(
        bytes32 indexed jobId,
        address reviewer,
        address reviewed,
        uint8 rating
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Submit a review for a completed job (platform only)
    /// @param jobId keccak256 of the order UUID
    /// @param reviewer The reviewer's wallet (buyer)
    /// @param reviewed The reviewed agent's wallet (seller)
    /// @param rating Score from 1 to 5
    function submitReview(
        bytes32 jobId,
        address reviewer,
        address reviewed,
        uint8 rating
    ) external onlyOwner {
        require(_reviews[jobId].timestamp == 0, "Review already exists");
        require(rating >= 1 && rating <= 5, "Rating must be 1-5");
        require(reviewer != address(0) && reviewed != address(0), "Invalid addresses");

        _reviews[jobId] = Review({
            reviewer: reviewer,
            reviewed: reviewed,
            rating: rating,
            timestamp: block.timestamp
        });

        _ratings[reviewed].sum += rating;
        _ratings[reviewed].count += 1;

        emit ReviewSubmitted(jobId, reviewer, reviewed, rating);
    }

    /// @notice Get number of reviews for an agent
    function getReviewCount(address agent) external view returns (uint256) {
        return _ratings[agent].count;
    }

    /// @notice Get aggregate rating (sum, count) for an agent
    function getAverageRating(address agent)
        external
        view
        returns (uint256 sum, uint256 count)
    {
        RatingAgg storage r = _ratings[agent];
        return (r.sum, r.count);
    }

    /// @notice Get a specific review by job ID
    function getReview(bytes32 jobId)
        external
        view
        returns (address reviewer, address reviewed, uint8 rating, uint256 timestamp)
    {
        Review storage r = _reviews[jobId];
        return (r.reviewer, r.reviewed, r.rating, r.timestamp);
    }
}
