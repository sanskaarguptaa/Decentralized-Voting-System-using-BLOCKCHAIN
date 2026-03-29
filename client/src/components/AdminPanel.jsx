import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

function AdminPanel({ jwtToken, contract, electionStatus, fetchState, currentElectionId }) {
  const [candidateName, setCandidateName] = useState('');
  const [loading, setLoading] = useState(false);
  const [electionDuration, setElectionDuration] = useState('');
  
  // KYC Pending users
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedVoters, setSelectedVoters] = useState([]);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  useEffect(() => {
    const approved = allUsers.filter(u => u.documentApproved).map(u => u.address);
    setSelectedVoters(approved);
  }, [allUsers]);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwtToken}`
  };

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/users", { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const pending = data.users.filter(u => !u.documentApproved);
      setPendingUsers(pending);
      setAllUsers(data.users || []);
    } catch(err) {
      console.error("Error fetching users:", err);
    }
  };

  const approveDocument = async (userAddress) => {
    setLoading(true);
    const tid = toast.loading(`Approving ${userAddress.substring(0,6)}...`);
    try {
      let targetEid = currentElectionId;
      if (targetEid === 0) {
          const initTx = await contract.createElection("Election Round 1");
          toast.loading('Initializing Election Round 1...', { id: tid });
          await initTx.wait();
          targetEid = 1;
      }

      // 1. Tell Smart Contract to authorize voter (Blockchain)
      const tx = await contract.authorizeVoter(targetEid, userAddress);
      toast.loading('Waiting for blockchain confirmation...', { id: tid });
      await tx.wait();

      // 2. Tell Backend to mark as approved (Centralized DB)
      await fetch("http://localhost:3001/api/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({ address: userAddress })
      });

      toast.success(`User Approved and Whitelisted!`, { id: tid });
      fetchPendingUsers();
      fetchState();
    } catch(error) {
      console.error(error);
      toast.error(error.reason || "Error authorizing user", { id: tid });
    }
    setLoading(false);
  };

  const revokeDocument = async (userAddress) => {
    setLoading(true);
    const tid = toast.loading(`Revoking ${userAddress.substring(0,6)}...`);
    try {
      if (currentElectionId > 0) {
        const tx = await contract.revokeVoter(currentElectionId, userAddress);
        toast.loading('Waiting for blockchain confirmation...', { id: tid });
        await tx.wait();
      }

      await fetch("http://localhost:3001/api/unapprove", {
        method: "POST",
        headers,
        body: JSON.stringify({ address: userAddress })
      });

      toast.success(`User Revoked successfully!`, { id: tid });
      fetchPendingUsers();
      fetchState();
    } catch(error) {
      console.error(error);
      toast.error(error.reason || "Error revoking user", { id: tid });
    }
    setLoading(false);
  };

  const initElection = async () => {
    setLoading(true);
    const nextId = currentElectionId + 1;
    const tid = toast.loading(`Initializing Election Round ${nextId} on Blockchain...`);
    try {
        const tx = await contract.createElection("Election Round " + nextId);
        await tx.wait();
        toast.success(`Election Round ${nextId} Initialized!`, { id: tid });
        fetchState();
    } catch (e) {
        toast.error(e.reason || "Failed to init election", { id: tid });
    }
    setLoading(false);
  }

  const addCandidate = async (e) => {
    e.preventDefault();
    if (!candidateName.trim()) return;
    setLoading(true);
    const tid = toast.loading("Adding candidate...");
    try {
      let targetEid = currentElectionId;
      if (targetEid === 0) {
          const initTx = await contract.createElection("Election Round 1");
          await initTx.wait();
          targetEid = 1;
      }

      const tx = await contract.addCandidate(targetEid, candidateName);
      toast.loading("Waiting for blockchain confirmation...", { id: tid });
      await tx.wait();
      setCandidateName('');
      toast.success("Candidate added!", { id: tid });
      fetchState();
    } catch (error) {
      console.error(error);
      toast.error(error.reason || "Error adding candidate", { id: tid });
    }
    setLoading(false);
  };

  const startElection = async () => {
    if(electionDuration <= 0) return toast.error("Duration must be > 0");
    if(selectedVoters.length === 0) {
      const proceed = window.confirm("No voters selected. Start election without whitelisting new voters?");
      if(!proceed) return;
    }
    setLoading(true);
    const tid = toast.loading("Configuring Election...");
    try {
      let targetEid = currentElectionId;
      if (targetEid === 0) {
          const initTx = await contract.createElection("Election Round 1");
          await initTx.wait();
          targetEid = 1;
      }

      if(selectedVoters.length > 0) {
        toast.loading("Whitelisting voters on-chain...", { id: tid });
        const authTx = await contract.authorizeVoters(targetEid, selectedVoters);
        await authTx.wait();
        
        for (const addr of selectedVoters) {
            await fetch("http://localhost:3001/api/approve", {
                method: "POST",
                headers,
                body: JSON.stringify({ address: addr })
            }).catch(e => console.error(e));
        }
      }

      const toRevoke = allUsers
          .filter(u => u.documentApproved && !selectedVoters.includes(u.address))
          .map(u => u.address);
      
      if (toRevoke.length > 0) {
          toast.loading("Revoking unselected voters on-chain...", { id: tid });
          const revTx = await contract.revokeVoters(targetEid, toRevoke);
          await revTx.wait();
          
          for (const addr of toRevoke) {
              await fetch("http://localhost:3001/api/unapprove", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ address: addr })
              }).catch(e => console.error(e));
          }
      }

      toast.loading("Starting Election on-chain...", { id: tid });

      const tx = await contract.startElection(targetEid, electionDuration);
      await tx.wait();
      toast.success("Election Started!", { id: tid });
      fetchState();
      fetchPendingUsers();
    } catch (error) {
      console.error(error);
      toast.error(error.reason || "Error starting election", { id: tid });
    }
    setLoading(false);
  };

  const endElection = async () => {
    setLoading(true);
    const tid = toast.loading("Closing election...");
    try {
      const tx = await contract.endElection(currentElectionId);
      await tx.wait();
      fetchState();
      toast.success("Election closed instantly!", { id: tid });
    } catch (error) {
      console.error(error);
      toast.error(error.reason || "Error ending election early", { id: tid });
    }
    setLoading(false);
  };

  const isConfigured = electionStatus.start > 0 || electionStatus.active || electionStatus.ended;

  return (
    <div className="bg-gray-900/60 p-6 sm:p-8 rounded-3xl border border-gray-800 backdrop-blur-md shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-purple-500/20 transition-all duration-700"></div>
      
      <div className="flex items-center gap-3 mb-8 border-b border-gray-800 pb-4 relative z-10">
         <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/50">
           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
         </div>
         <h2 className="text-3xl font-extrabold text-white tracking-tight">Admin Command Center</h2>
         
         {(!isConfigured || electionStatus.ended) && (
            <button onClick={initElection} disabled={loading} className="ml-auto bg-gray-800 text-gray-300 px-4 py-2 rounded shadow text-sm border border-gray-700 hover:bg-gray-700 cursor-pointer">
               Initialize Round #{currentElectionId + 1}
            </button>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* ADD CANDIDATE */}
        <div className="bg-gray-800/80 p-5 rounded-2xl border border-gray-700/50 space-y-4 shadow-sm hover:border-indigo-500/30 transition-colors">
          <h3 className="text-lg font-semibold text-gray-200">1. Add Candidates</h3>
          {electionStatus.ended ? (
             <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                 <p className="text-red-400 font-bold text-sm">Election Completed</p>
                 <p className="text-gray-400 text-xs mt-1">Cannot add candidates anymore.</p>
             </div>
          ) : (
             <>
               <p className="text-sm text-gray-400">Available only before the election starts.</p>
               <form onSubmit={addCandidate} className="flex flex-col gap-3">
                 <input 
                   type="text" 
                   placeholder="Candidate Name" 
                   className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-gray-100 placeholder-gray-500 font-bold"
                   value={candidateName}
                   onChange={(e) => setCandidateName(e.target.value)}
                   disabled={loading || isConfigured}
                 />
                 <button 
                   type="submit" 
                   className="w-full bg-indigo-600/90 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent border border-indigo-500/50 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 cursor-pointer flex justify-center items-center gap-2"
                   disabled={loading || isConfigured}
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                   Add Candidate
                 </button>
               </form>
             </>
          )}
        </div>

        {/* KYC APPROVAL */}
        <div className="bg-gray-800/80 p-5 rounded-2xl border border-gray-700/50 space-y-4 shadow-sm hover:border-indigo-500/30 transition-colors">
          <h3 className="text-lg font-semibold text-gray-200 flex justify-between items-center">
             2. Document Approvals
             <span className="bg-indigo-500 text-xs px-2 py-1 rounded-full text-white">{pendingUsers.length}</span>
          </h3>
          <p className="text-sm text-gray-400">Review Government IDs and whitelist users.</p>
          <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
             {pendingUsers.length === 0 ? (
               <div className="text-center text-gray-500 text-sm py-4 italic">No pending requests</div>
             ) : (
               pendingUsers.map(u => (
                 <div key={u.id} className="bg-gray-900 p-3 rounded-xl border border-gray-700 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                       <div>
                         <div className="text-sm font-bold text-gray-200">{u.name}</div>
                         <div className="text-xs text-indigo-400 font-mono">ID: {u.documentId}</div>
                       </div>
                    </div>
                    <button onClick={() => approveDocument(u.address)} disabled={loading} className="w-full py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">
                       Approve & Whitelist
                    </button>
                 </div>
               ))
             )}
          </div>
          <button onClick={fetchPendingUsers} className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors underline">Refresh List</button>
        </div>

        {/* ELECTION TIMER & START */}
        <div className="bg-gray-800/80 p-5 rounded-2xl border border-gray-700/50 space-y-4 shadow-sm hover:border-emerald-500/30 transition-colors md:col-span-2 lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-200">3. Launch Election</h3>
          
          {electionStatus.ended ? (
             <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center flex flex-col items-center justify-center gap-2 py-8 mt-4">
                 <svg className="w-8 h-8 text-red-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                 <p className="text-red-400 font-bold text-lg">Election Permanently Locked</p>
                 <p className="text-gray-400 text-xs">Initialize a new round from the top context menu.</p>
             </div>
          ) : (
             <>
               <p className="text-sm text-gray-400">Set duration or terminate active polls.</p>
               <div className="flex flex-col gap-3">
                 {!electionStatus.active ? (
                   <div className="flex flex-col gap-3">
                     <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar bg-gray-900/50 rounded-xl border border-gray-700 p-2">
                       <div className="text-xs text-gray-400 mb-2 px-1">Select Eligible Voters</div>
                       {allUsers.length === 0 ? (
                          <div className="text-center text-gray-500 text-xs py-2 italic">No users available</div>
                       ) : (
                          allUsers.map(u => (
                            <label key={u.id || u.address} className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900 bg-gray-800"
                                checked={selectedVoters.includes(u.address)}
                                onChange={(e) => {
                                  if(e.target.checked) setSelectedVoters([...selectedVoters, u.address]);
                                  else setSelectedVoters(selectedVoters.filter(addr => addr !== u.address));
                                }}
                                disabled={isConfigured || loading}
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-200">{u.name}</span>
                                <span className="text-xs text-gray-500 font-mono">{u.address.substring(0,8)}...</span>
                              </div>
                              {u.documentApproved && <span className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">Approved</span>}
                            </label>
                          ))
                       )}
                     </div>

                     <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                       <input 
                         type="number" 
                         min="1"
                         placeholder="Duration" 
                         className="w-full bg-transparent outline-none text-gray-100 font-bold"
                         value={electionDuration}
                         onChange={(e) => setElectionDuration(e.target.value)}
                         disabled={isConfigured || loading}
                       />
                       <span className="text-gray-500 font-medium">Minutes</span>
                     </div>
                     
                     <button 
                       onClick={startElection}
                       className="w-full bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent border border-emerald-500/50 py-3 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgba(16,185,129,0.2)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.3)] active:scale-95 flex justify-center items-center gap-2 cursor-pointer"
                       disabled={isConfigured || loading}
                     >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Start Election
                     </button>
                   </div>
                 ) : (
                   <button 
                     onClick={endElection}
                     className="w-full bg-red-600/90 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent border border-red-500/50 py-4 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgba(239,68,68,0.2)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.3)] active:scale-95 flex justify-center items-center gap-2 cursor-pointer h-full"
                     disabled={loading}
                   >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                     Close Election Instantly
                   </button>
                 )}
               </div>
             </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
