import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const StateSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm flex items-center justify-between"
      >
        <span className={`truncate w-full pr-2 text-left ${value ? 'text-white' : 'text-gray-400'}`}>{value || 'Select State'}</span>
        <svg className={`shrink-0 w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1">
          <style>{`
            .hide-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <ul 
            className="max-h-60 overflow-y-auto hide-scroll" 
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            {INDIAN_STATES.map(st => (
              <li 
                key={st}
                onClick={() => {
                  onChange(st);
                  setIsOpen(false);
                }}
                className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${value === st ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
              >
                {st}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

function ProfilePanel({ currentUser, jwtToken, onUserUpdate, onBack }) {
  const [addressFields, setAddressFields] = useState(() => {
    const addr = currentUser?.residentialAddress || '';
    const parts = addr.split(',').map(s => s.trim());
    return {
        street: parts[0] || '',
        district: parts[1] || '',
        state: parts[2] || '',
        pincode: parts[3] || ''
    };
  });
  
  const [altMobile, setAltMobile] = useState(() => {
    let mob = currentUser?.alternateMobileNo || '';
    if (mob.startsWith('+91 ')) mob = mob.substring(4);
    else if (mob.startsWith('+91')) mob = mob.substring(3);
    return mob.trim();
  });
  const [updating, setUpdating] = useState(false);
  const hasProfileData = Boolean(currentUser?.residentialAddress || currentUser?.alternateMobileNo);
  const [isEditing, setIsEditing] = useState(!hasProfileData);

  const [searchDocId, setSearchDocId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const [familyData, setFamilyData] = useState({ linkedMembers: [], pendingIncoming: [], pendingOutgoing: [] });
  const [familyLoading, setFamilyLoading] = useState(true);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwtToken}`
  };

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    setFamilyLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/family", { headers });
      const data = await res.json();
      if (res.ok) {
        setFamilyData(data);
      } else {
        console.error(data.error);
      }
    } catch (e) {
      console.error(e);
    }
    setFamilyLoading(false);
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    const tid = toast.loading("Updating profile...");
    try {
      const fullAddress = `${addressFields.street}, ${addressFields.district}, ${addressFields.state}, ${addressFields.pincode}`.replace(/^[\s,]+|[\s,]+$/g, '').trim();
      const mobileToSave = altMobile ? `+91 ${altMobile}` : '';
      const res = await fetch("http://localhost:3001/api/profile", {
        method: "PUT",
        headers,
        body: JSON.stringify({ residentialAddress: fullAddress, alternateMobileNo: mobileToSave })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Profile updated successfully!", { id: tid });
      onUserUpdate(data.user);
      setIsEditing(false);
    } catch (err) {
      toast.error(err.message, { id: tid });
    }
    setUpdating(false);
  };

  const searchFamily = async (e) => {
    e.preventDefault();
    if (!searchDocId) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`http://localhost:3001/api/family/search?documentId=${encodeURIComponent(searchDocId)}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResult(data.user);
    } catch (err) {
      toast.error(err.message);
    }
    setSearching(false);
  };

  const sendRequest = async () => {
    if (!searchResult) return;
    const tid = toast.loading("Sending request...");
    try {
      const res = await fetch("http://localhost:3001/api/family/request", {
        method: "POST",
        headers,
        body: JSON.stringify({ targetAddress: searchResult.address })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Link request sent!", { id: tid });
      setSearchResult(null);
      setSearchDocId('');
      fetchFamilyData();
    } catch (err) {
      toast.error(err.message, { id: tid });
    }
  };

  const respondToRequest = async (requestId, action) => {
    const tid = toast.loading(`${action === 'accept' ? 'Accepting' : 'Rejecting'} request...`);
    try {
      const res = await fetch("http://localhost:3001/api/family/respond", {
        method: "POST",
        headers,
        body: JSON.stringify({ requestId, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Request ${action}ed!`, { id: tid });
      fetchFamilyData();
    } catch (err) {
      toast.error(err.message, { id: tid });
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 mt-8 shadow-2xl relative overflow-hidden">
        <button onClick={onBack} className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Dashboard
        </button>

        <div className="flex flex-col items-center mt-8 mb-10">
           <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center border border-indigo-500/50 mb-4 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
             <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
           </div>
           <h2 className="text-3xl font-bold text-white tracking-wide">{currentUser?.name}</h2>
           <p className="text-indigo-400 font-mono text-sm mt-1">{currentUser?.address}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PERSONAL INFO */}
            <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 relative z-10 shadow-inner">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-3 flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Profile Information
                    </div>
                </h3>
                
                {isEditing ? (
                    <form onSubmit={updateProfile} className="space-y-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3 border-b border-gray-800 pb-2">Residential Address</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    <input 
                                       type="text"
                                       className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-white text-sm"
                                       placeholder="Address"
                                       value={addressFields.street}
                                       onChange={e => setAddressFields({...addressFields, street: e.target.value})}
                                    />
                                    <input 
                                       type="text"
                                       className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-white text-sm"
                                       placeholder="District"
                                       value={addressFields.district}
                                       onChange={e => setAddressFields({...addressFields, district: e.target.value})}
                                    />
                                    <StateSelect 
                                       value={addressFields.state}
                                       onChange={val => setAddressFields({...addressFields, state: val})}
                                    />
                                    <input 
                                       type="text"
                                       className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-white text-sm"
                                       placeholder="Pin Code"
                                       value={addressFields.pincode}
                                       onChange={e => setAddressFields({...addressFields, pincode: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3 border-b border-gray-800 pb-2">Contact Details</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Mobile Number</label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-gray-700 bg-gray-800 text-gray-400 text-sm font-medium">
                                                +91
                                            </span>
                                            <input 
                                               type="tel"
                                               className="flex-1 w-full bg-gray-900 border border-gray-700 rounded-r-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-white text-sm"
                                               placeholder="XXXXX XXXXX"
                                               value={altMobile}
                                               maxLength="11"
                                               onChange={e => {
                                                   let val = e.target.value.replace(/\D/g, '');
                                                   if (val.length > 5) {
                                                       val = val.substring(0, 5) + ' ' + val.substring(5, 10);
                                                   }
                                                   setAltMobile(val);
                                               }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3 border-b border-gray-800 pb-2">Static Details</label>
                                <div className="flex flex-col space-y-3">
                                    <div className="flex-1 w-full bg-gray-900 px-4 py-3 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium">Email</span>
                                        <span className="text-sm text-white font-medium truncate ml-2">{currentUser?.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex-1 w-full bg-gray-900 px-4 py-3 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Government ID</span>
                                        <span className="text-sm text-white font-medium truncate ml-2">{currentUser?.documentId || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-800 flex gap-3">
                            {hasProfileData && (
                                <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-xl font-bold transition-colors bg-gray-800 hover:bg-gray-700 text-gray-300">
                                    Cancel
                                </button>
                            )}
                            <button type="submit" disabled={updating} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 py-3 rounded-xl font-bold transition-colors shadow-lg">
                                {updating ? 'Saving...' : 'Save Profile Changes'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3 border-b border-gray-800 pb-2">Residential Address</label>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                                    <p className="text-white text-sm">{currentUser?.residentialAddress || 'Not set'}</p>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3 border-b border-gray-800 pb-2">Contact Details</label>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                                    <p className="text-white text-sm">
                                        <span className="text-gray-500 mr-2">Mobile:</span> 
                                        {currentUser?.alternateMobileNo || 'Not set'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-3 border-b border-gray-800 pb-2">Static Details</label>
                                <div className="flex flex-col space-y-3">
                                    <div className="flex-1 w-full bg-gray-900 px-4 py-3 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium">Email</span>
                                        <span className="text-sm text-white font-medium truncate ml-2">{currentUser?.email || 'N/A'}</span>
                                    </div>
                                    <div className="flex-1 w-full bg-gray-900 px-4 py-3 rounded-xl border border-gray-800 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Government ID</span>
                                        <span className="text-sm text-white font-medium truncate ml-2">{currentUser?.documentId || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-800">
                            <button type="button" onClick={() => setIsEditing(true)} className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg border border-gray-700">
                                Update Profile
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FAMILY LINKING */}
            <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 relative z-10 shadow-inner flex flex-col">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-800 pb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Family Link
                </h3>
                
                <form onSubmit={searchFamily} className="flex gap-2 mb-6">
                    <input 
                        type="text" 
                        placeholder="Search Government ID" 
                        className="flex-1 border border-gray-700 bg-gray-900 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        value={searchDocId}
                        onChange={e => setSearchDocId(e.target.value)}
                    />
                    <button type="submit" disabled={searching} className="bg-gray-800 hover:bg-gray-700 text-emerald-400 px-4 py-2 rounded-xl font-bold border border-gray-700 transition-colors disabled:opacity-50">
                        {searching ? '...' : 'Search'}
                    </button>
                </form>

                {searchResult && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl mb-6 flex items-center justify-between">
                        <div>
                            <p className="text-emerald-400 font-bold">{searchResult.name}</p>
                            <p className="text-xs text-gray-400 font-mono">ID: {searchResult.maskedDocId}</p>
                        </div>
                        <button onClick={sendRequest} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                            Send Request
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    {familyLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto"></div>
                        </div>
                    ) : (
                        <>
                            {/* Incoming Requests */}
                            {familyData.pendingIncoming.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Incoming Requests</h4>
                                    <div className="space-y-2">
                                        {familyData.pendingIncoming.map((req) => (
                                            <div key={req.requestDetails.id} className="bg-gray-900 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-200 font-bold">{req.user.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{req.user.address.substring(0,10)}...</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => respondToRequest(req.requestDetails.id, 'accept')} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors">Accept</button>
                                                    <button onClick={() => respondToRequest(req.requestDetails.id, 'reject')} className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors">Reject</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending Outgoing */}
                            {familyData.pendingOutgoing.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Pending Outgoing</h4>
                                    <div className="space-y-2">
                                        {familyData.pendingOutgoing.map((req) => (
                                            <div key={req.requestDetails.id} className="bg-gray-900 border border-gray-700 border-dashed p-3 rounded-xl flex items-center justify-between opacity-70">
                                                <div>
                                                    <p className="text-sm text-gray-300 font-bold">{req.user.name}</p>
                                                    <p className="text-xs text-gray-500">Awaiting their response...</p>
                                                </div>
                                                <span className="text-[10px] uppercase font-bold text-yellow-500 tracking-wider">Pending</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Linked Members */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Linked Members</h4>
                                {familyData.linkedMembers.length === 0 ? (
                                    <p className="text-xs text-gray-500 italic">No family members linked yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {familyData.linkedMembers.map((req) => (
                                            <div key={req.requestDetails.id} className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl flex gap-3 items-center">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-200 font-bold">{req.user.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{req.user.documentId} • {req.user.address.substring(0,8)}...</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}

export default ProfilePanel;
