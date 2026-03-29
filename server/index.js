require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-prod";

app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
});
app.use("/api/nonce", authLimiter);
app.use("/api/verify", authLimiter);

const dbPath = path.join(__dirname, "db.json");

// Helper to interact with JSON DB
const readDB = () => {
  if (!fs.existsSync(dbPath)) return { users: [], nonces: {}, familyRequests: [] };
  try {
    const data = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(data || '{"users":[], "nonces":{}, "familyRequests":[]}');
    if (!parsed.users) parsed.users = [];
    if (!parsed.nonces) parsed.nonces = {};
    if (!parsed.familyRequests) parsed.familyRequests = [];
    return parsed;
  } catch (e) {
    return { users: [], nonces: {}, familyRequests: [] };
  }
};

const writeDB = (data) => {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
};

// Ensure DB exists
if (!fs.existsSync(dbPath)) writeDB({ users: [], nonces: {}, familyRequests: [] });

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// 1. Get Nonce for SIWE
app.get("/api/nonce", (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: "Address required" });

  const nonce = `Sign this message to authenticate with Voting System.\n\nNonce: ${Math.floor(Math.random() * 1000000000)}`;
  
  const db = readDB();
  db.nonces[address.toLowerCase()] = nonce;
  writeDB(db);

  res.json({ nonce });
});

// 2. Verify Signature and Login
app.post("/api/verify", (req, res) => {
  const { address, signature } = req.body;
  if (!address || !signature) return res.status(400).json({ error: "Address and signature required" });

  const db = readDB();
  const nonce = db.nonces[address.toLowerCase()];
  
  if (!nonce) return res.status(400).json({ error: "No nonce generated for this address" });

  try {
    const recoveredAddress = ethers.verifyMessage(nonce, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Clear nonce
    delete db.nonces[address.toLowerCase()];
    writeDB(db);

    const user = db.users.find(u => u.address.toLowerCase() === address.toLowerCase());
    
    // Create JWT
    const token = jwt.sign({ address: address.toLowerCase() }, JWT_SECRET, { expiresIn: '24h' });

    if (!user) {
      return res.json({ 
        token, 
        isNewUser: true,
        message: "Authentication successful, please complete registration" 
      });
    }

    res.json({ 
      token, 
      user,
      isNewUser: false,
      message: "Login successful" 
    });

  } catch (error) {
    res.status(400).json({ error: "Signature verification failed" });
  }
});

// 3. Complete Registration Profile (Protected)
app.post("/api/register", authenticateToken, (req, res) => {
  const { name, email, documentId, mobileNo } = req.body;
  const address = req.user.address;

  if (!name || !email || !documentId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const db = readDB();
  const existing = db.users.find(u => u.address.toLowerCase() === address.toLowerCase());
  
  if (existing) {
    return res.status(400).json({ error: "User already registered" });
  }

  const newUser = {
    id: Date.now().toString(),
    name,
    email,
    mobileNo: mobileNo || "",
    documentId,
    address,
    documentApproved: false,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  res.json({
    message: "Registration successful. Pending Admin Approval.",
    user: newUser
  });
});

// 4. Admin - Get All Users (Protected)
app.get("/api/users", authenticateToken, (req, res) => {
  const db = readDB();
  res.json({ users: db.users });
});

// 5. Admin - Approve Document (Protected)
app.post("/api/approve", authenticateToken, (req, res) => {
  const { address } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.address.toLowerCase() === address.toLowerCase());
  
  if(userIndex === -1) return res.status(404).json({ error: "User not found" });
  
  db.users[userIndex].documentApproved = true;
  writeDB(db);
  res.json({ message: "Document Approved", user: db.users[userIndex] });
});

// 6. Admin - Unapprove Document (Revoke) (Protected)
app.post("/api/unapprove", authenticateToken, (req, res) => {
  const { address } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.address.toLowerCase() === address.toLowerCase());
  
  if(userIndex === -1) return res.status(404).json({ error: "User not found" });
  
  db.users[userIndex].documentApproved = false;
  writeDB(db);
  res.json({ message: "Document Unapproved", user: db.users[userIndex] });
});

// 7. User - Update Profile (Protected)
app.put("/api/profile", authenticateToken, (req, res) => {
  const { residentialAddress, alternateMobileNo } = req.body;
  const address = req.user.address;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.address.toLowerCase() === address.toLowerCase());
  
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  if (residentialAddress !== undefined) db.users[userIndex].residentialAddress = residentialAddress;
  if (alternateMobileNo !== undefined) db.users[userIndex].alternateMobileNo = alternateMobileNo;
  
  writeDB(db);
  res.json({ message: "Profile updated successfully", user: db.users[userIndex] });
});

// 8. Family - Search User by Document ID (Protected)
app.get("/api/family/search", authenticateToken, (req, res) => {
  const { documentId } = req.query;
  if (!documentId) return res.status(400).json({ error: "documentId required" });
  
  const db = readDB();
  const foundUser = db.users.find(u => u.documentId === documentId);
  
  if (!foundUser) return res.status(404).json({ error: "No user found with this Government ID" });
  
  if (foundUser.address.toLowerCase() === req.user.address.toLowerCase()) {
    return res.status(400).json({ error: "You cannot search for yourself" });
  }

  // Mask details for privacy
  res.json({
    user: {
      address: foundUser.address,
      name: foundUser.name,
      maskedDocId: foundUser.documentId.substring(0, 4) + '...'
    }
  });
});

// 9. Family - Send Link Request (Protected)
app.post("/api/family/request", authenticateToken, (req, res) => {
  const { targetAddress } = req.body;
  const fromAddress = req.user.address.toLowerCase();
  
  if (!targetAddress) return res.status(400).json({ error: "Target address required" });
  if (fromAddress === targetAddress.toLowerCase()) return res.status(400).json({ error: "Cannot link to yourself" });

  const db = readDB();
  
  // Verify target user exists
  if (!db.users.find(u => u.address.toLowerCase() === targetAddress.toLowerCase())) {
     return res.status(404).json({ error: "Target user not found" });
  }

  // Check if already linked or pending
  const existingRequest = db.familyRequests.find(r => 
    (r.fromAddress === fromAddress && r.toAddress === targetAddress.toLowerCase()) ||
    (r.fromAddress === targetAddress.toLowerCase() && r.toAddress === fromAddress)
  );

  if (existingRequest) {
    if (existingRequest.status === 'pending') return res.status(400).json({ error: "A pending request already exists between you." });
    if (existingRequest.status === 'accepted') return res.status(400).json({ error: "You are already linked to this user." });
  }

  const newReq = {
    id: crypto.randomBytes(8).toString("hex"),
    fromAddress,
    toAddress: targetAddress.toLowerCase(),
    status: "pending",
    createdAt: new Date().toISOString()
  };

  db.familyRequests.push(newReq);
  writeDB(db);

  res.json({ message: "Link request sent successfully", request: newReq });
});

// 10. Family - Get Connections and Requests (Protected)
app.get("/api/family", authenticateToken, (req, res) => {
  const address = req.user.address.toLowerCase();
  const db = readDB();
  
  const userRequests = db.familyRequests.filter(r => r.fromAddress === address || r.toAddress === address);
  
  const pendingIncoming = [];
  const pendingOutgoing = [];
  const linkedMembers = [];

  userRequests.forEach(req => {
     let otherAddress = req.fromAddress === address ? req.toAddress : req.fromAddress;
     let otherUser = db.users.find(u => u.address.toLowerCase() === otherAddress);
     let otherInfo = otherUser ? { name: otherUser.name, address: otherUser.address, documentId: otherUser.documentId ? otherUser.documentId.substring(0,4)+'***' : '' } : { address: otherAddress };

     if (req.status === 'accepted') {
        linkedMembers.push({ requestDetails: req, user: otherInfo });
     } else if (req.status === 'pending') {
        if (req.toAddress === address) {
           pendingIncoming.push({ requestDetails: req, user: otherInfo });
        } else {
           pendingOutgoing.push({ requestDetails: req, user: otherInfo });
        }
     }
  });

  res.json({ linkedMembers, pendingIncoming, pendingOutgoing });
});

// 11. Family - Respond to Request (Protected)
app.post("/api/family/respond", authenticateToken, (req, res) => {
  const { requestId, action } = req.body; // action: 'accept' or 'reject'
  const address = req.user.address.toLowerCase();
  
  if (!requestId || !['accept', 'reject'].includes(action)) {
     return res.status(400).json({ error: "Invalid request ID or action" });
  }

  const db = readDB();
  const reqIndex = db.familyRequests.findIndex(r => r.id === requestId);
  
  if (reqIndex === -1) return res.status(404).json({ error: "Request not found" });
  
  const familyReq = db.familyRequests[reqIndex];
  if (familyReq.toAddress !== address) {
     return res.status(403).json({ error: "You can only respond to requests sent to you" });
  }
  
  if (familyReq.status !== 'pending') {
     return res.status(400).json({ error: "Request is already processed" });
  }

  familyReq.status = action === 'accept' ? 'accepted' : 'rejected';
  
  // If rejected, maybe remove it or keep as history. Let's keep it with status 'rejected'.
  // Actually, filtering them out in GET /api/family hides rejected ones.

  writeDB(db);
  res.json({ message: `Request ${action}ed successfully`, request: familyReq });
});

app.listen(PORT, () => {
  console.log(`Secure Voting API Server running on port ${PORT}`);
});
