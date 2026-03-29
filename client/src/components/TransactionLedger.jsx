import React, { useState, useEffect } from 'react';

function TransactionLedger({ contract, isAdmin }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    if (!contract) return;

    fetchPastEvents();

    const handleEvent = async (type, detailsBuilder, ...args) => {
        const eventPayload = args[args.length - 1]; 
        const log = eventPayload.log || eventPayload; 
        try {
            const block = await log.getBlock();
            const newLog = {
              type,
              details: detailsBuilder(args),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp: block ? block.timestamp * 1000 : Date.now()
            };
            setLogs((prev) => {
                if(prev.some(l => l.txHash === newLog.txHash && l.type === newLog.type && l.details === newLog.details)) return prev;
                return [newLog, ...prev].sort((a,b) => b.blockNumber - a.blockNumber);
            });
        } catch(e) {
            console.error("Live listener log block error:", e);
        }
    };

    const onElectionCreated = (...args) => handleEvent("Election Created", a => `Election '${a[1]}' initialized.`, ...args);
    const onCandidateAdded = (...args) => handleEvent("Candidate Added", a => `Candidate '${a[2]}' inserted.`, ...args);
    const onElectionConfigured = (...args) => handleEvent("Election Started", a => `Timer active.`, ...args);
    const onVoterAuthorized = (...args) => handleEvent("Voter Whitelisted", a => `Address ${a[1]?.substring(0,8)}... approved.`, ...args);
    const onVoterRevoked = (...args) => handleEvent("Voter Revoked", a => `Address ${a[1]?.substring(0,8)}... revoked.`, ...args);
    const onVoteCasted = (...args) => handleEvent("Vote Casted", a => `Vote submitted by ${a[1]?.substring(0,8)}...`, ...args);

    contract.on("ElectionCreated", onElectionCreated);
    contract.on("CandidateAdded", onCandidateAdded);
    contract.on("ElectionConfigured", onElectionConfigured);
    contract.on("VoterAuthorized", onVoterAuthorized);
    contract.on("VoterRevoked", onVoterRevoked);
    contract.on("VoteCasted", onVoteCasted);

    return () => {
      contract.off("ElectionCreated", onElectionCreated);
      contract.off("CandidateAdded", onCandidateAdded);
      contract.off("ElectionConfigured", onElectionConfigured);
      contract.off("VoterAuthorized", onVoterAuthorized);
      contract.off("VoterRevoked", onVoterRevoked);
      contract.off("VoteCasted", onVoteCasted);
    }
  }, [contract]);

  const fetchPastEvents = async () => {
    try {
      setLoading(true);
      const pastEvents = [];
      const blocksCache = {};

      const processEvent = async (e, type, detailsBuilder) => {
        let timestamp = Date.now();
        if(!blocksCache[e.blockNumber]) {
          const b = await e.getBlock();
          blocksCache[e.blockNumber] = b.timestamp * 1000;
        }
        timestamp = blocksCache[e.blockNumber];
        return { type, details: detailsBuilder(e.args), txHash: e.transactionHash, blockNumber: e.blockNumber, timestamp };
      };

      const eCreates = await contract.queryFilter("ElectionCreated");
      for(const e of eCreates) pastEvents.push(await processEvent(e, "Election Created", args => `Election '${args[1]}' initialized.`));

      const cAdds = await contract.queryFilter("CandidateAdded");
      for(const e of cAdds) pastEvents.push(await processEvent(e, "Candidate Added", args => `Candidate '${args[2]}' inserted.`));

      const eConfs = await contract.queryFilter("ElectionConfigured");
      for(const e of eConfs) pastEvents.push(await processEvent(e, "Election Started", args => `Timer active.`));

      const vAuths = await contract.queryFilter("VoterAuthorized");
      for(const e of vAuths) pastEvents.push(await processEvent(e, "Voter Whitelisted", args => `Address ${args[1]?.substring(0,8)}... approved.`));

      const vRevs = await contract.queryFilter("VoterRevoked");
      for(const e of vRevs) pastEvents.push(await processEvent(e, "Voter Revoked", args => `Address ${args[1]?.substring(0,8)}... revoked.`));

      const vCasts = await contract.queryFilter("VoteCasted");
      for(const e of vCasts) pastEvents.push(await processEvent(e, "Vote Casted", args => `Vote submitted by ${args[1]?.substring(0,8)}...`));

      setLogs(pastEvents.sort((a,b) => b.blockNumber - a.blockNumber));
    } catch(err) {
      console.error("Error fetching ledger", err);
    }
    setLoading(false);
  };

  const openModal = async (log) => {
    if (!isAdmin) return;
    setSelectedTx({ loading: true, log });
    try {
       const tx = await contract.runner.provider.getTransaction(log.txHash);
       const receipt = await contract.runner.provider.getTransactionReceipt(log.txHash);
       setSelectedTx({ loading: false, log, tx, receipt });
    } catch(err) {
       console.error("Error fetching tx details:", err);
       setSelectedTx({ loading: false, log, error: "Failed to load details" });
    }
  };

  const closeModal = () => setSelectedTx(null);

  return (
     <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 mt-8 shadow-[0_0_40px_rgba(16,185,129,0.05)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
        <div className="flex items-center gap-4 mb-6 relative z-10">
           <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/50">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </div>
           <div>
             <h2 className="text-2xl font-bold text-white tracking-wide">Blockchain Ledger</h2>
             <p className="text-sm text-gray-400">Immutable, transparent record of all verified actions</p>
           </div>
           <button onClick={fetchPastEvents} className="ml-auto bg-gray-800 hover:bg-gray-700 text-emerald-400 p-2 rounded-lg border border-gray-700 transition" disabled={loading} title="Refresh Ledger">
             <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>
        
        {loading ? (
          <div className="animate-pulse flex gap-4"><div className="w-full h-12 bg-gray-800 rounded"></div></div>
        ) : logs.length === 0 ? (
          <div className="text-gray-500 text-center py-6 italic border border-dashed border-gray-700 rounded-xl">No transactions found on the blockchain.</div>
        ) : (
          <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-950 relative z-10 shadow-inner">
            <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-gray-900 text-gray-400 text-sm uppercase tracking-wider">
                   <th className="p-4 border-b border-gray-800 font-semibold">Type</th>
                   <th className="p-4 border-b border-gray-800 font-semibold">Details</th>
                   <th className="p-4 border-b border-gray-800 font-semibold">Block</th>
                   <th className="p-4 border-b border-gray-800 font-semibold">Tx Hash</th>
                 </tr>
               </thead>
               <tbody>
                  {logs.map((log, i) => (
                    <tr 
                      key={i} 
                      onClick={() => openModal(log)}
                      className={`hover:bg-gray-800/80 transition-colors border-b border-gray-900 last:border-0 group/row ${isAdmin ? 'cursor-pointer' : ''}`}
                    >
                       <td className="p-4 font-bold text-emerald-400 text-sm">
                          <span className="bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/20 group-hover/row:border-emerald-500/40">{log.type}</span>
                       </td>
                       <td className="p-4 text-gray-300 text-sm">
                          {log.details}
                          <div className="text-[10px] text-gray-500 mt-1">{new Date(log.timestamp).toLocaleString()}</div>
                       </td>
                       <td className="p-4 font-mono text-xs text-indigo-400"><div className="bg-indigo-500/10 px-2 py-1 inline-block rounded border border-indigo-500/20">#{log.blockNumber}</div></td>
                       <td className="p-4 font-mono text-xs text-gray-500 max-w-[150px]"><span className="truncate block" title={log.txHash}>{log.txHash}</span></td>
                    </tr>
                  ))}
               </tbody>
            </table>
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedTx && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 p-6 rounded-2xl max-w-2xl w-full shadow-2xl relative">
                    <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                       <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Transaction Details
                    </h3>
                    
                    {selectedTx.loading ? (
                        <div className="text-center py-8">
                           <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                           <p className="text-gray-400">Fetching deep blockchain data...</p>
                        </div>
                    ) : selectedTx.error ? (
                        <div className="text-red-400 text-center py-8">{selectedTx.error}</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col gap-3">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <span className="text-sm font-bold text-gray-300">Transaction Hash</span>
                                    <span className="font-mono text-xs text-indigo-400 break-all">{selectedTx.tx?.hash || selectedTx.log.txHash}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                                   <span className="block text-xs text-gray-500 mb-1">Block Number</span>
                                   <span className="font-mono text-sm text-gray-200">{selectedTx.tx?.blockNumber || selectedTx.log.blockNumber}</span>
                                </div>
                                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                                   <span className="block text-xs text-gray-500 mb-1">Gas Used</span>
                                   <span className="font-mono text-sm text-gray-200">{selectedTx.receipt?.gasUsed?.toString() || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col gap-3">
                                <div>
                                    <span className="block text-xs text-gray-500 mb-1">From (Sender)</span>
                                    <span className="font-mono text-sm text-gray-200 break-all">{selectedTx.tx?.from || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-gray-500 mb-1">To (Contract)</span>
                                    <span className="font-mono text-sm text-gray-200 break-all">{selectedTx.tx?.to || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div className="bg-gray-950 p-4 rounded-xl border border-gray-800">
                                <span className="block text-xs text-gray-500 mb-2">Primary Action</span>
                                <span className="inline-block bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                                   {selectedTx.log.type}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
     </div>
  );
}

export default TransactionLedger;
