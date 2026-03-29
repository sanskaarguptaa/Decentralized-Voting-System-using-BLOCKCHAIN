import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function UserPanel({ contract, candidates, electionStatus, account, fetchState, disabledOverride, currentElectionId }) {
  const [loading, setLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkVoterStatus();
  }, [account, contract, disabledOverride]);

  const checkVoterStatus = async () => {
    if(!contract || !account) return;
    try {
      // electionId = 1
      let targetEid = currentElectionId === 0 ? 1 : currentElectionId;
      const voterData = await contract.electionVoters(targetEid, account);
      setIsAuthorized(voterData.isRegistered);
      setHasVoted(voterData.hasVoted);
    } catch(err) {
      console.error(err);
    }
  };

  const castVote = async (candidateId) => {
    setLoading(true);
    const tid = toast.loading("Please sign the transaction in your wallet...");
    try {
      const tx = await contract.vote(currentElectionId, candidateId);
      toast.loading("Transaction submitted. Waiting for confirmation...", { id: tid });
      await tx.wait();
      
      fetchState();
      checkVoterStatus();
      toast.success("Vote securely recorded on the blockchain!", { id: tid });
    } catch (error) {
      console.error(error);
      toast.error(error.reason || "Error casting vote", { id: tid });
    }
    setLoading(false);
  };

  const totalVotes = candidates.reduce((acc, curr) => acc + parseInt(curr.voteCount), 0);
  
  const maxVotes = Math.max(...candidates.map(c => parseInt(c.voteCount)), 0);
  const winners = candidates.filter(c => parseInt(c.voteCount) === maxVotes && maxVotes > 0);
  
  const isWinner = (id) => electionStatus.ended && winners.some(w => w.id === id);

  return (
    <div className="bg-gray-900 p-6 sm:p-10 rounded-3xl border border-gray-800 shadow-2xl relative mt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          Candidates Overview
        </h2>
        
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-sm font-semibold border ${isAuthorized && !disabledOverride ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30'}`}>
            {isAuthorized && !disabledOverride ? '✓ Whitelisted Voter' : '✕ Not Whitelisted'}
          </div>
          {hasVoted && (
             <div className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
               Vote Logged
             </div>
          )}
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="text-center p-16 bg-gray-800/50 rounded-3xl border border-dashed border-gray-700">
          <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
          <p className="text-gray-400 text-xl font-medium">No candidates registered yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c) => {
            const votePercentage = totalVotes > 0 ? (parseInt(c.voteCount) / totalVotes) * 100 : 0;
            const winningStyle = isWinner(c.id) ? "border-yellow-500/60 shadow-[0_0_30px_rgba(234,179,8,0.15)] bg-gray-800" : "border-gray-800 bg-gray-800/60 hover:border-gray-600";
            
            return (
              <div key={c.id} className={`p-6 sm:p-8 rounded-3xl border transition-all duration-300 relative overflow-hidden group hover:-translate-y-1 ${winningStyle}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150 group-hover:bg-blue-500/10"></div>
                
                {isWinner(c.id) && (
                  <div className="absolute top-5 right-5 text-yellow-500 flex items-center gap-1">
                    <svg className="w-5 h-5 animate-bounce" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    <span className="font-bold text-sm tracking-wide uppercase">Winner</span>
                  </div>
                )}

                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 truncate pr-8" title={c.name}>{c.name}</h3>
                
                <div className="mt-8 mb-8 relative z-10">
                  <div className="flex justify-between items-end mb-3">
                    <div className={`text-5xl font-black text-transparent bg-clip-text drop-shadow-sm pb-1 ${isWinner(c.id) ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500'}`}>
                      {c.voteCount}
                    </div>
                  </div>
                  
                  <div className="w-full bg-gray-900 rounded-full h-3 mb-3 overflow-hidden ring-1 ring-white/5 shadow-inner">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${isWinner(c.id) ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} style={{ width: `${votePercentage}%` }}>
                       <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-gray-400">
                    <span>{votePercentage.toFixed(1)}%</span>
                    <span>{totalVotes} Total</span>
                  </div>
                </div>

                <button 
                  onClick={() => castVote(c.id)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-800 disabled:text-gray-600 disabled:border-transparent disabled:shadow-none border border-blue-500/50 py-4 rounded-2xl font-bold text-lg transition-all shadow-[0_5px_20px_rgba(59,130,246,0.3)] hover:shadow-[0_8px_30px_rgba(59,130,246,0.5)] active:scale-95 cursor-pointer relative z-10 hidden sm:block"
                  disabled={!electionStatus.active || loading || hasVoted || !isAuthorized || disabledOverride}
                >
                  {hasVoted ? 'Vote Submitted' : (!isAuthorized || disabledOverride) ? 'Not Authorized' : electionStatus.active ? 'Cast Vote Now' : 'Voting Closed'}
                </button>
                <button 
                  onClick={() => castVote(c.id)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-800 disabled:text-gray-500 py-3 rounded-xl font-bold transition-all active:scale-95 sm:hidden"
                  disabled={!electionStatus.active || loading || hasVoted || !isAuthorized || disabledOverride}
                >
                  Vote
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
