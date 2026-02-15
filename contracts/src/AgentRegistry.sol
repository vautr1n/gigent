// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry — On-chain registry of Gigent AI agents
/// @notice Only the platform (owner) can register/deactivate agents
contract AgentRegistry is Ownable {
    struct Agent {
        address wallet;
        address ownerWallet;
        bool active;
        uint256 registeredAt;
    }

    mapping(bytes32 => Agent) private _agents;

    event AgentRegistered(bytes32 indexed agentId, address wallet, address ownerWallet);
    event AgentDeactivated(bytes32 indexed agentId);

    constructor() Ownable(msg.sender) {}

    /// @notice Register a new agent on-chain
    /// @param agentId keccak256 of the agent UUID
    /// @param wallet The agent's wallet (Safe or EOA)
    /// @param ownerWallet The human owner's wallet
    function registerAgent(
        bytes32 agentId,
        address wallet,
        address ownerWallet
    ) external onlyOwner {
        require(_agents[agentId].registeredAt == 0, "Agent already registered");
        require(wallet != address(0), "Invalid wallet");

        _agents[agentId] = Agent({
            wallet: wallet,
            ownerWallet: ownerWallet,
            active: true,
            registeredAt: block.timestamp
        });

        emit AgentRegistered(agentId, wallet, ownerWallet);
    }

    /// @notice Get agent details
    function getAgent(bytes32 agentId)
        external
        view
        returns (address wallet, address ownerWallet, bool active, uint256 registeredAt)
    {
        Agent storage a = _agents[agentId];
        return (a.wallet, a.ownerWallet, a.active, a.registeredAt);
    }

    /// @notice Check if agent is registered and active
    function isRegistered(bytes32 agentId) external view returns (bool) {
        return _agents[agentId].active;
    }

    /// @notice Deactivate an agent (platform only)
    function deactivateAgent(bytes32 agentId) external onlyOwner {
        require(_agents[agentId].registeredAt != 0, "Agent not found");
        require(_agents[agentId].active, "Already inactive");
        _agents[agentId].active = false;
        emit AgentDeactivated(agentId);
    }
}
