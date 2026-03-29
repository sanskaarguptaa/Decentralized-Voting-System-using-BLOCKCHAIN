import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers.js";

const { ethers } = hre;

describe("Voting Contract Phase 2 (Multiple Elections)", function () {
  let Voting;
  let voting;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    Voting = await ethers.getContractFactory("Voting");
    [owner, addr1, addr2] = await ethers.getSigners();
    voting = await Voting.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await voting.admin()).to.equal(owner.address);
    });
  });

  describe("Election Management and Whitelist", function () {
    beforeEach(async function () {
      await voting.createElection("Presidential Election");
    });

    it("Should create an election successfully", async function () {
      const electionCount = await voting.electionCount();
      expect(electionCount).to.equal(1);
      
      const election = await voting.elections(1);
      expect(election.name).to.equal("Presidential Election");
    });

    it("Should allow admin to add candidates", async function () {
      await voting.addCandidate(1, "Alice");
      const candidates = await voting.getCandidates(1);
      expect(candidates.length).to.equal(1);
      expect(candidates[0].name).to.equal("Alice");
    });

    it("Should allow admin to authorize voters", async function () {
      await voting.authorizeVoter(1, addr1.address);
      const voter = await voting.electionVoters(1, addr1.address);
      expect(voter.isRegistered).to.equal(true);
    });

    it("Should start the election with duration", async function () {
      await voting.startElection(1, 60); // 60 minutes
      const [isActive, hasEnded, start, end] = await voting.getElectionStatus(1);
      expect(isActive).to.equal(true);
      expect(hasEnded).to.equal(false);
    });
  });

  describe("Voting Process", function () {
    beforeEach(async function () {
      await voting.createElection("Presidential Election");
      await voting.addCandidate(1, "Alice");
      await voting.authorizeVoter(1, addr1.address);
      await voting.startElection(1, 10); // 10 minutes
    });

    it("Should allow an authorized voter to cast a vote", async function () {
      await voting.connect(addr1).vote(1, 1);
      const candidates = await voting.getCandidates(1);
      expect(candidates[0].voteCount).to.equal(1);
    });

    it("Should prevent unauthorized voters from voting", async function () {
      await expect(voting.connect(addr2).vote(1, 1)).to.be.revertedWith("You are not an authorized voter");
    });

    it("Should prevent double voting", async function () {
      await voting.connect(addr1).vote(1, 1);
      await expect(voting.connect(addr1).vote(1, 1)).to.be.revertedWith("You have already voted");
    });
    
    it("Should prevent voting after election ends", async function () {
      // Fast forward time by 11 minutes
      await time.increase(11 * 60);
      await expect(voting.connect(addr1).vote(1, 1)).to.be.revertedWith("Election has ended");
    });
  });
});
