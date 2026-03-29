import React, { useState } from 'react';
import toast from 'react-hot-toast';

function Web3ProfileForm({ jwtToken, walletAddress, onProfileComplete }) {
  const [formData, setFormData] = useState({ name: '', email: '', mobileNo: '', documentId: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const tid = toast.loading("Submitting profile to admin...");
    try {
      const res = await fetch("http://localhost:3001/api/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      
      toast.success("Profile submitted successfully!", { id: tid });
      onProfileComplete(data.user);
    } catch(err) {
      toast.error(err.message, { id: tid });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.1)] mt-10 animate-in fade-in zoom-in duration-500">
       <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
       </div>
       <h2 className="text-2xl font-extrabold mb-2 text-center text-white">Complete Your Profile</h2>
       <p className="text-gray-400 text-sm text-center mb-8">You successfully securely authenticated. Since this is your first time, please provide identity details for Admin approval.</p>
       
       <form onSubmit={handleSubmit} className="flex flex-col gap-4">
         <input required type="text" placeholder="Full Name" className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white focus:border-indigo-500 focus:outline-none" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
         <input required type="email" placeholder="Email Address" className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white focus:border-indigo-500 focus:outline-none" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})}/>
         <input required type="tel" placeholder="Mobile Number" className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white focus:border-indigo-500 focus:outline-none" value={formData.mobileNo} onChange={e=>setFormData({...formData, mobileNo: e.target.value})}/>
         <input required type="text" placeholder="Government ID / Voter ID No." className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white focus:border-indigo-500 focus:outline-none" value={formData.documentId} onChange={e=>setFormData({...formData, documentId: e.target.value})} />
         
         <div className="text-xs text-gray-500 font-mono bg-gray-950 p-2 rounded border border-gray-800 break-all mt-2">
            Wallet: {walletAddress}
         </div>

         <button disabled={loading} className="p-4 mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all shadow-[0_4px_14px_0_rgba(79,70,229,0.3)] active:scale-95 cursor-pointer">
           {loading ? 'Submitting...' : 'Submit to Admin Review'}
         </button>
       </form>
    </div>
  );
}

export default Web3ProfileForm;
