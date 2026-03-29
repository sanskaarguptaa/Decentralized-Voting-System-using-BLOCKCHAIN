# Decentralized Voting System 
Welcome to the production-ready Decentralized Voting application that utilizes Web3 technologies, smart contracts, and secure backend routing.

## 🚀 Key Improvements

1. **Sign-In With Ethereum (SIWE)**: No private keys are generated computationally or stored centrally anymore. Users securely authenticate by connecting their MetaMask or Web3Auth wallets and signing a random nonce to get a JWT session token.
2. **Reentrancy Guards & Tight Validations**: The `Voting.sol` smart contract implements `nonReentrant` modifiers and tight validation to prevent duplicate votes, out-of-bounds candidate voting, and state tracking.
3. **Multiple Elections Support**: The smart contract supports deploying multiple elections simultaneously through internal structs, mapped by an `electionId`.
4. **Enhanced React UI / UX**: A premium glassmorphism interface with dynamic Shimmer effects, loading toasts mapping to blockchain transactions, and data masking.

## 🏃‍♂️ Getting Started

### 1. Installation

Install all dependencies located in the root using the newly provided `package.json`:

```bash
cd "Voting System"
npm install
```

### 2. Smart Contract Initialization

Start the local Hardhat Node in one terminal:
```bash
npm run blockchain
```

In a second terminal, deploy the smart contract logic:
```bash
npm run deploy:local
```

### 3. Start Application

Run the node backend and the React frontend concurrently:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`.
The backend will run on `http://localhost:5000`.

## 🧪 Running Tests

The smart contracts are thoroughly verified with unit tests. Run them using:

```bash
npm run test
```
