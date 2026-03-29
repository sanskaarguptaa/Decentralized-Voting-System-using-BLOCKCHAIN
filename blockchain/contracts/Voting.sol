// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

// Simple Reentrancy Guard (in-lined to avoid bringing in entire OZ if not needed, but can easily use OZ instead).
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != ENTERED, "ReentrancyGuard: reentrant call");
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}

contract Voting is ReentrancyGuard {
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedCandidateId;
    }

    struct Election {
        uint256 id;
        string name;
        uint256 startTime;
        uint256 endTime;
        bool isConfigured;
        uint256 candidatesCount;
        uint256 totalVotes;
    }

    address public admin;
    uint256 public electionCount;

    // mappings
    mapping(uint256 => Election) public elections;
    
    // electionId => (candidateId => Candidate)
    mapping(uint256 => mapping(uint256 => Candidate)) public electionCandidates;
    
    // electionId => (voterAddress => Voter)
    mapping(uint256 => mapping(address => Voter)) public electionVoters;

    // Events
    event ElectionCreated(uint256 indexed electionId, string name);
    event ElectionConfigured(uint256 indexed electionId, uint256 startTime, uint256 endTime);
    event CandidateAdded(uint256 indexed electionId, uint256 candidateId, string name);
    event VoterAuthorized(uint256 indexed electionId, address indexed voter);
    event VoterRevoked(uint256 indexed electionId, address indexed voter);
    event VoteCasted(uint256 indexed electionId, address indexed voter, uint256 candidateId, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(_electionId > 0 && _electionId <= electionCount, "Election does not exist");
        _;
    }

    modifier electionActive(uint256 _electionId) {
        Election storage e = elections[_electionId];
        require(e.isConfigured, "Election not configured");
        require(block.timestamp >= e.startTime, "Election has not started yet");
        require(block.timestamp < e.endTime, "Election has ended");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Create a new election
     */
    function createElection(string memory _name) public onlyAdmin {
        electionCount++;
        Election storage e = elections[electionCount];
        e.id = electionCount;
        e.name = _name;
        
        emit ElectionCreated(electionCount, _name);
    }

    /**
     * @dev Configure the election schedule
     */
    function startElection(uint256 _electionId, uint256 _durationInMinutes) public onlyAdmin electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(!e.isConfigured, "Election has already been configured");
        
        e.startTime = block.timestamp;
        e.endTime = e.startTime + (_durationInMinutes * 1 minutes);
        e.isConfigured = true;
        
        emit ElectionConfigured(_electionId, e.startTime, e.endTime);
    }

    /**
     * @dev End the election immediately
     */
    function endElection(uint256 _electionId) public onlyAdmin electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.isConfigured, "Election not yet configured");
        if (block.timestamp < e.endTime) {
            e.endTime = block.timestamp;
        }
    }

    /**
     * @dev Add a candidate to an election
     */
    function addCandidate(uint256 _electionId, string memory _name) public onlyAdmin electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(!e.isConfigured, "Cannot add candidates after election starts");
        
        e.candidatesCount++;
        uint256 candidateId = e.candidatesCount;
        
        electionCandidates[_electionId][candidateId] = Candidate({
            id: candidateId,
            name: _name,
            voteCount: 0
        });
        
        emit CandidateAdded(_electionId, candidateId, _name);
    }

    /**
     * @dev Whitelist a voter for an election
     */
    function authorizeVoter(uint256 _electionId, address _voter) public onlyAdmin electionExists(_electionId) {
        Voter storage v = electionVoters[_electionId][_voter];
        require(!v.isRegistered, "Voter already authorized");
        v.isRegistered = true;
        
        emit VoterAuthorized(_electionId, _voter);
    }

    /**
     * @dev Whitelist multiple voters at once for an election
     */
    function authorizeVoters(uint256 _electionId, address[] calldata _votersToAuthorize) public onlyAdmin electionExists(_electionId) {
        for (uint i = 0; i < _votersToAuthorize.length; i++) {
            address voterAddr = _votersToAuthorize[i];
            Voter storage v = electionVoters[_electionId][voterAddr];
            if (!v.isRegistered) {
                v.isRegistered = true;
                emit VoterAuthorized(_electionId, voterAddr);
            }
        }
    }

    /**
     * @dev Revoke a whitelisted voter
     */
    function revokeVoter(uint256 _electionId, address _voter) public onlyAdmin electionExists(_electionId) {
        Voter storage v = electionVoters[_electionId][_voter];
        require(v.isRegistered, "Voter not authorized");
        require(!v.hasVoted, "Voter has already voted");
        v.isRegistered = false;
        
        emit VoterRevoked(_electionId, _voter);
    }

    /**
     * @dev Revoke multiple voters at once
     */
    function revokeVoters(uint256 _electionId, address[] calldata _votersToRevoke) public onlyAdmin electionExists(_electionId) {
        for (uint i = 0; i < _votersToRevoke.length; i++) {
            address voterAddr = _votersToRevoke[i];
            Voter storage v = electionVoters[_electionId][voterAddr];
            if (v.isRegistered && !v.hasVoted) {
                v.isRegistered = false;
                emit VoterRevoked(_electionId, voterAddr);
            }
        }
    }

    /**
     * @dev Cast a vote
     */
    function vote(uint256 _electionId, uint256 _candidateId) public nonReentrant electionExists(_electionId) electionActive(_electionId) {
        Election storage e = elections[_electionId];
        Voter storage sender = electionVoters[_electionId][msg.sender];
        
        require(sender.isRegistered, "You are not an authorized voter");
        require(!sender.hasVoted, "You have already voted");
        require(_candidateId > 0 && _candidateId <= e.candidatesCount, "Invalid candidate ID");

        sender.hasVoted = true;
        sender.votedCandidateId = _candidateId;
        
        electionCandidates[_electionId][_candidateId].voteCount++;
        e.totalVotes++;

        emit VoteCasted(_electionId, msg.sender, _candidateId, block.timestamp);
    }

    /**
     * @dev Get all candidates for an election
     */
    function getCandidates(uint256 _electionId) public view electionExists(_electionId) returns (Candidate[] memory) {
        uint256 cCount = elections[_electionId].candidatesCount;
        Candidate[] memory candidateArray = new Candidate[](cCount);
        
        for (uint256 i = 1; i <= cCount; i++) {
            candidateArray[i - 1] = electionCandidates[_electionId][i];
        }
        return candidateArray;
    }

    /**
     * @dev Get election status securely
     */
    function getElectionStatus(uint256 _electionId) public view electionExists(_electionId) returns (bool isActive, bool hasEnded, uint256 start, uint256 end) {
        Election storage e = elections[_electionId];
        if (!e.isConfigured) {
            return (false, false, 0, 0);
        }
        bool active = block.timestamp >= e.startTime && block.timestamp < e.endTime;
        bool ended = block.timestamp >= e.endTime;
        return (active, ended, e.startTime, e.endTime);
    }
}
