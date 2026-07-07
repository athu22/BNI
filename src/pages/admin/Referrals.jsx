import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Search, Handshake, Users, Plus, X, Calendar, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

export default function Referrals() {
  const [members, setMembers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [manualReferrals, setManualReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { success, error } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const roundsQuery = query(collection(db, 'rounds'), orderBy('roundNumber', 'asc'));
      const roundsSnap = await getDocs(roundsQuery);
      const roundsData = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const manualSnap = await getDocs(collection(db, 'manual_referrals'));
      const manualData = manualSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setMembers(membersData);
      setRounds(roundsData);
      setManualReferrals(manualData);
    } catch (err) {
      console.error(err);
      // Collections might not exist yet, that's fine
      error("Failed to load referrals data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute aggregated referrals
  // Returns: { [receiverId]: [giverId1, giverId2, ...] }
  const getAggregatedReferrals = () => {
    const agg = {};
    members.forEach(m => agg[m.id] = []);

    // From rounds
    rounds.forEach(round => {
      if (!round.referrals) return;
      Object.values(round.referrals).forEach(tableRefs => {
        // tableRefs = { giverId: [receiverId1, receiverId2] }
        Object.entries(tableRefs).forEach(([giverId, receivers]) => {
          if (Array.isArray(receivers)) {
            receivers.forEach(recId => {
              if (agg[recId]) agg[recId].push({ giverId, source: `Round ${round.roundNumber}` });
            });
          }
        });
      });
    });

    // From manual_referrals
    manualReferrals.forEach(mr => {
      if (agg[mr.receiverId]) {
        agg[mr.receiverId].push({ giverId: mr.giverId, source: 'Manual Add' });
      }
    });

    return agg;
  };

  const aggregated = getAggregatedReferrals();

  const filteredMembers = members.filter(m => 
    (m.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.memberCode || '').toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    const countA = aggregated[a.id]?.length || 0;
    const countB = aggregated[b.id]?.length || 0;
    return countB - countA; // Sort by most referrals first
  });

  const getMemberName = (id) => {
    const m = members.find(x => x.id === id);
    return m ? m.memberName : 'Unknown Member';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Global Referrals</h1>
          <p className="text-sm text-gray-500">Track and manage all referrals received by members.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-bni-red focus:border-bni-red sm:text-sm transition-colors"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-32">
               <Skeleton className="h-6 w-3/4 mb-4" />
               <Skeleton className="h-4 w-1/2" />
             </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map(member => {
            const count = aggregated[member.id]?.length || 0;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  setSelectedMember(member);
                  setIsModalOpen(true);
                }}
                className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{member.memberName}</h3>
                  </div>
                  <div className="text-xs text-gray-500 mb-4 font-mono">{member.memberCode} • {member.chapter}</div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
                  <div className="flex items-center text-sm font-medium text-gray-600">
                    <Handshake className="w-4 h-4 mr-1.5 text-gray-400" />
                    Received
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {count} Referrals
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {isModalOpen && selectedMember && (
        <MemberReferralsModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          member={selectedMember}
          referralsReceived={aggregated[selectedMember.id] || []}
          allMembers={members}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

function MemberReferralsModal({ isOpen, onClose, member, referralsReceived, allMembers, onSuccess }) {
  const [selectedGiverIds, setSelectedGiverIds] = useState([]);
  const [giverSearchQuery, setGiverSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  const handleAddReferrals = async () => {
    if (selectedGiverIds.length === 0) {
      error("Please select at least one member who gave a referral");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Create all manual referrals in parallel
      const promises = selectedGiverIds.map(giverId => 
        addDoc(collection(db, 'manual_referrals'), {
          receiverId: member.id,
          giverId: giverId,
          addedAt: serverTimestamp()
        })
      );
      
      await Promise.all(promises);
      
      success(`Successfully added ${selectedGiverIds.length} manual referrals!`);
      setSelectedGiverIds([]);
      setGiverSearchQuery('');
      onSuccess(); // Re-fetch all data to show updated list
    } catch (err) {
      console.error(err);
      error("Failed to add referrals.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGiver = (id) => {
    if (selectedGiverIds.includes(id)) {
      setSelectedGiverIds(selectedGiverIds.filter(x => x !== id));
    } else {
      setSelectedGiverIds([...selectedGiverIds, id]);
    }
  };

  const availableGivers = allMembers
    .filter(m => m.id !== member.id)
    .filter(m => (m.memberName || '').toLowerCase().includes(giverSearchQuery.toLowerCase()) || 
                 (m.memberCode || '').toLowerCase().includes(giverSearchQuery.toLowerCase()));

  const getMemberName = (id) => {
    const m = allMembers.find(x => x.id === id);
    return m ? m.memberName : 'Unknown Member';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{member.memberName}'s Referrals</h2>
                <p className="text-sm text-gray-500 mt-1">Total Received: {referralsReceived.length}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 bg-gray-50/30 flex flex-col md:flex-row gap-6">
              
              {/* Left Column: List of received referrals */}
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <Handshake className="w-4 h-4 mr-2 text-green-600" /> 
                  Received From
                </h3>
                {referralsReceived.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center border border-gray-100 shadow-sm">
                    <p className="text-gray-400 italic text-sm">No referrals received yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referralsReceived.map((ref, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mr-3 font-bold text-xs border border-blue-100">
                            {getMemberName(ref.giverId).charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900 text-sm">{getMemberName(ref.giverId)}</span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase bg-gray-100 text-gray-500 px-2 py-1 rounded">
                          {ref.source}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Add Manual Referral */}
              <div className="md:w-80 shrink-0 flex flex-col h-full">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col h-full max-h-[60vh] md:max-h-[70vh]">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center shrink-0">
                    <UserPlus className="w-4 h-4 mr-2 text-blue-600" />
                    Quick Add Referrals
                  </h3>
                  
                  <div className="relative mb-3 shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-bni-red focus:border-bni-red"
                      placeholder="Search members..."
                      value={giverSearchQuery}
                      onChange={(e) => setGiverSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto mb-4 space-y-1 pr-1 border border-gray-100 rounded-lg p-1 bg-gray-50/50">
                    {availableGivers.map(m => {
                      const isSelected = selectedGiverIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleGiver(m.id)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-all flex items-center ${
                            isSelected 
                              ? 'bg-green-50 border-green-500 text-green-700 shadow-sm font-medium' 
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 shrink-0 ${isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          </div>
                          <div className="truncate">
                            <span className="block truncate">{m.memberName}</span>
                            <span className="text-[10px] text-gray-400 font-mono block leading-tight">{m.memberCode}</span>
                          </div>
                        </button>
                      );
                    })}
                    {availableGivers.length === 0 && (
                      <div className="p-4 text-center text-xs text-gray-400 italic">
                        No matching members found
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 pt-2 border-t border-gray-100">
                    <Button 
                      className="w-full text-sm" 
                      onClick={handleAddReferrals}
                      isLoading={isSubmitting}
                      disabled={selectedGiverIds.length === 0}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Save {selectedGiverIds.length > 0 ? `(${selectedGiverIds.length})` : ''} Referrals
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
