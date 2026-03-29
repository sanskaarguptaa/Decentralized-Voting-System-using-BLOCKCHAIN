import React, { useState } from 'react';

function Register({ onLoginSwitch }) {
  const [formData, setFormData] = useState({ name: '', email: '', documentId: '' });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [registrationData, setRegistrationData] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      setRegistrationData(data);
      setStep(2); // Move to OTP
    } catch(err) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: registrationData.address, otp })
      });
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      setStep(3); // Success show private key
    } catch(err) {
      alert(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-[0_0_40px_rgba(79,70,229,0.1)]">
       <h2 className="text-2xl font-extrabold mb-6 text-center text-white">Voter Registration (KYC)</h2>
       
       {step === 1 && (
         <form onSubmit={handleRegister} className="flex flex-col gap-4">
           <input required type="text" placeholder="Full Name" className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
           <input required type="email" placeholder="Email Address" className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})}/>
           <input required type="text" placeholder="Government ID / License No." className="p-3 bg-gray-800 rounded-xl border border-gray-700 text-white" value={formData.documentId} onChange={e=>setFormData({...formData, documentId: e.target.value})} />
           <button disabled={loading} className="p-4 mt-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-all uppercase tracking-wider text-sm shadow-lg active:scale-95">
             {loading ? 'Processing...' : 'Register & Get OTP'}
           </button>
           <button type="button" onClick={onLoginSwitch} className="text-sm text-gray-500 hover:text-gray-300 transition mt-2">Already registered? Log in here</button>
         </form>
       )}

       {step === 2 && (
         <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
           <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl text-orange-400 text-sm text-center">
             An OTP has been generated for <b>{formData.email}</b>!<br/><br/>
             <span className="text-xs text-gray-400">Since we are on localhost, check the Terminal where Node Server is running to view your OTP code.</span>
           </div>
           <input required autoFocus type="text" placeholder="Enter 4-digit OTP" className="p-4 bg-gray-950 rounded-xl border border-gray-700 text-white text-center text-3xl tracking-[1em] focus:border-indigo-500 outline-none" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={4} />
           <button disabled={loading} className="p-4 mt-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white transition-all uppercase tracking-wider text-sm shadow-lg active:scale-95">
             {loading ? 'Verifying...' : 'Verify Identity'}
           </button>
         </form>
       )}

       {step === 3 && (
         <div className="flex flex-col gap-4 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-white">Verification Complete!</h3>
            <p className="text-sm text-gray-400 leading-relaxed mb-2">Save your Private Key securely right now. This is your permanent, immutable password for logging in to cast your vote.</p>
            <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl break-all font-mono text-emerald-400 text-sm selection:bg-emerald-500 selection:text-white shadow-inner">
               {registrationData?.privateKey}
            </div>
            <p className="text-xs text-orange-500 font-bold uppercase mt-1 tracking-wider">Warning: Strictly Confidential</p>
            <button onClick={onLoginSwitch} className="mt-4 p-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95">
              Continue to Login Portal
            </button>
         </div>
       )}
    </div>
  );
}
export default Register;
