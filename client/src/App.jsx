import { useState, useEffect } from 'react';
import { Contract } from 'ethers';
import { Toaster } from 'react-hot-toast';
import AdminPanel from './components/AdminPanel';
import UserPanel from './components/UserPanel';
import Login from './components/Login';
import Web3ProfileForm from './components/Web3ProfileForm';
import TransactionLedger from './components/TransactionLedger';
import ProfilePanel from './components/ProfilePanel';
import contractData from './contractData.json';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [kycUser, setKycUser] = useState(null);
  const [jwtToken, setJwtToken] = useState(null);
  
  const [electionStatus, setElectionStatus] = useState({ active: false, ended: false, start: 0, end: 0 });
  const [candidates, setCandidates] = useState([]);
  const [currentElectionId, setCurrentElectionId] = useState(0);
  
  const [view, setView] = useState('login'); // 'login' | 'app' // 'register' route is removed since it's handled via SIWE

  useEffect(() => {
    if (contract) {
      fetchElectionState();
    }
  }, [contract]);

  const handleLoginSuccess = async (signer, user, token) => {
    try {
      if(!contractData.address || contractData.address === "0x0") return alert("Contract not deployed!");
      
      const signerAddress = await signer.getAddress();
      const votingContract = new Contract(contractData.address, contractData.abi, signer);
      setContract(votingContract);
      setAccount(signerAddress);
      setKycUser(user);
      setJwtToken(token);
      
      const adminAddress = await votingContract.admin();
      setIsAdmin(signerAddress.toLowerCase() === adminAddress.toLowerCase() || user?.isAdminOverride);
      setView('app');
    } catch(e) {
      console.error(e);
      toast.error("Error initializing blockchain state: " + e.message, { duration: 10000 });
    }
  };

  const fetchElectionState = async () => {
    try {
      const eCount = await contract.electionCount();
      const count = Number(eCount);
      setCurrentElectionId(count);

      if (count === 0) {
         setElectionStatus({ active: false, ended: false, start: 0, end: 0 });
         setCandidates([]);
         return;
      }

      const [active, ended, start, end] = await contract.getElectionStatus(count);
      setElectionStatus({ active, ended, start: Number(start), end: Number(end) });

      const candidatesArray = await contract.getCandidates(count);
      const formattedCandidates = candidatesArray.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        voteCount: c.voteCount.toString(),
      }));
      setCandidates(formattedCandidates);
    } catch (error) {
      console.error("Error fetching state:", error);
    }
  };

  const logout = () => {
    localStorage.removeItem('voting_session');
    setAccount(null);
    setContract(null);
    setIsAdmin(false);
    setKycUser(null);
    setJwtToken(null);
    setView('login');
  };

  // UI helper for shortening addresses
  const shortenAddress = (addr) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500 selection:text-white pb-12">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1f2937', color: '#fff', borderRadius: '12px', border: '1px solid #374151' } }} />
      <nav className="bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 p-4 shadow-xl flex justify-between items-center border-b border-white/5">
        <h1 className="text-2xl tracking-wide font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 cursor-default">
          Decentralized Voting
        </h1>
        {account ? (
          <div className="flex items-center gap-3">
            {isAdmin && <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs tracking-wider uppercase font-bold rounded-full border border-purple-500/30">Admin</span>}
            {!kycUser?.documentApproved && !isAdmin && !kycUser?.isNewWeb3User && <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 text-xs tracking-wider uppercase font-bold rounded-full border border-yellow-500/30">Pending Approval</span>}
            <button 
              onClick={() => { if(kycUser && !kycUser.isNewWeb3User) setView('profile'); }} 
              className={`bg-gray-800 px-4 py-2 rounded-lg text-sm font-mono shadow-inner border border-gray-700 text-gray-300 ${kycUser && !kycUser.isNewWeb3User ? 'hover:bg-gray-700 hover:text-white transition-colors cursor-pointer' : 'cursor-default'}`}
              title={kycUser && !kycUser.isNewWeb3User ? "Manage Profile & Family" : ""}
            >
              {kycUser?.name || shortenAddress(account)}
            </button>
            <button onClick={logout} className="ml-2 bg-red-600/80 hover:bg-red-500 px-3 py-2 rounded-lg text-sm font-bold transition">Logout</button>
          </div>
        ) : (
          <div className="text-gray-400 font-medium text-sm">Authentication Required</div>
        )}
      </nav>

      <main className="container mx-auto p-4 sm:p-6 mt-8">
        {view === 'login' && <Login onLoginSuccess={handleLoginSuccess} />}
        
        {view === 'app' && kycUser?.isNewWeb3User && (
          <Web3ProfileForm 
            jwtToken={jwtToken}
            walletAddress={account} 
            onProfileComplete={(updatedUser) => setKycUser(updatedUser)} 
          />
        )}

        {view === 'profile' && kycUser && !kycUser.isNewWeb3User && (
          <ProfilePanel 
             currentUser={kycUser} 
             jwtToken={jwtToken} 
             onUserUpdate={(updatedUser) => {
                setKycUser(updatedUser);
                const session = JSON.parse(localStorage.getItem('voting_session'));
                if(session) {
                   session.user = updatedUser;
                   localStorage.setItem('voting_session', JSON.stringify(session));
                }
             }}
             onBack={() => setView('app')} 
          />
        )}

        {view === 'app' && !kycUser?.isNewWeb3User && (
          <div className="grid gap-8 max-w-6xl mx-auto animate-in fade-in zoom-in duration-500">
            
            {/* ELECTION STATUS BANNER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-900/80 p-6 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-sm gap-4 relative overflow-hidden">
               <div className="absolute left-0 bottom-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50"></div>
              <div>
                <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                  Election Status
                </h3>
                <p className="text-sm text-gray-400 mt-1">Live updates from the Blockchain Ledger</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-right">
                {electionStatus.start > 0 && !electionStatus.ended && (
                   <span className="text-sm font-mono text-gray-300 bg-gray-800 px-3 py-1 rounded-lg border border-gray-700">
                     Ends: {new Date(electionStatus.end * 1000).toLocaleString()}
                   </span>
                )}
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wide ${electionStatus.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : electionStatus.ended ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'}`}>
                  {electionStatus.active ? 'Active' : electionStatus.ended ? 'Ended' : 'Not Started'}
                </span>
              </div>
            </div>

            {!kycUser?.documentApproved && !isAdmin && (
              <div className="p-6 bg-yellow-500/10 border border-yellow-500/50 rounded-2xl text-yellow-500 flex items-center gap-4">
                 <svg className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 <div>
                   <h4 className="font-bold text-lg mb-1">Identity Pending Approval</h4>
                   <p className="text-sm text-yellow-600/80">Your Government ID has been successfully securely uploaded. An admin must verify your document before you can be whitelisted onto the blockchain to vote.</p>
                 </div>
              </div>
            )}

            {isAdmin && <AdminPanel jwtToken={jwtToken} contract={contract} electionStatus={electionStatus} fetchState={fetchElectionState} currentElectionId={currentElectionId} />}
            <UserPanel contract={contract} candidates={candidates} electionStatus={electionStatus} account={account} fetchState={fetchElectionState} disabledOverride={!isAdmin && !kycUser?.documentApproved} currentElectionId={currentElectionId} />
            <TransactionLedger contract={contract} isAdmin={isAdmin} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
