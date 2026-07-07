import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { LogOut, Search, Printer, AlertCircle, Check, X, Handshake } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

function ReferralModal({ isOpen, onClose, round, tableId, membersAtTable, onSuccess }) {
  const [referralData, setReferralData] = useState({});
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (round && isOpen) {
      setReferralData(round.referrals?.[tableId] || {});
    }
  }, [round, isOpen, tableId]);

  if (!isOpen || !round) return null;

  const toggleReferral = (giverId, receiverId) => {
    setReferralData(prev => {
      const current = prev[giverId] || [];
      if (current.includes(receiverId)) {
        return { ...prev, [giverId]: current.filter(id => id !== receiverId) };
      } else {
        return { ...prev, [giverId]: [...current, receiverId] };
      }
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const roundRef = doc(db, 'rounds', round.id);
      const newReferrals = { ...(round.referrals || {}) };
      newReferrals[tableId] = referralData;
      
      await updateDoc(roundRef, {
        referrals: newReferrals
      });
      
      success("Referrals saved successfully!");
      onSuccess();
    } catch (err) {
      console.error(err);
      error("Failed to save referrals");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Handshake className="w-5 h-5 mr-2 text-green-600" />
                  Record Referrals - Round {round.roundNumber}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Select who gave referrals to whom at your table.</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1 bg-gray-50/30">
              {membersAtTable.length <= 1 ? (
                <div className="text-center text-gray-500 italic p-8">
                  Not enough members at this table to record referrals.
                </div>
              ) : (
                <div className="space-y-6">
                  {membersAtTable.map(receiver => (
                    <div key={receiver.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <div className="font-semibold text-gray-900 mb-4 flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mr-3 font-bold text-sm">
                          {receiver.memberName?.charAt(0) || '?'}
                        </div>
                        {receiver.memberName} <span className="text-gray-500 font-normal ml-1">received a referral from:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {membersAtTable.filter(m => m.id !== receiver.id).map(giver => {
                          const isSelected = (referralData[giver.id] || []).includes(receiver.id);
                          return (
                            <button
                              key={giver.id}
                              onClick={() => toggleReferral(giver.id, receiver.id)}
                              className={`flex items-center p-3 rounded-lg border text-sm transition-all text-left ${isSelected ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                            >
                              <div className={`w-4 h-4 rounded-sm border mr-3 flex items-center justify-center shrink-0 ${isSelected ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300'}`}>
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                              <span className="truncate font-medium">{giver.memberName}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 bg-white flex justify-end space-x-3 shrink-0">
              <Button variant="outline" onClick={onClose} className="w-24">Cancel</Button>
              <Button onClick={handleSave} isLoading={loading} className="min-w-[140px] bg-green-600 hover:bg-green-700">
                Save Referrals
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function CaptainDashboard() {
  const { currentUser, logout } = useAuth();
  
  const [tables, setTables] = useState([]);
  const [members, setMembers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState('');

  const [activeRound, setActiveRound] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMembers, setModalMembers] = useState([]);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const tablesSnap = await getDocs(collection(db, 'tables'));
      const tablesData = tablesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      tablesData.sort((a, b) => a.tableName.localeCompare(b.tableName, undefined, { numeric: true }));

      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const roundsQuery = query(collection(db, 'rounds'), orderBy('roundNumber', 'asc'));
      const roundsSnap = await getDocs(roundsQuery);
      const roundsData = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setTables(tablesData);
      setMembers(membersData);
      setRounds(roundsData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMember = (id) => members.find(m => m.id === id);

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const captain = selectedTable ? getMember(selectedTable.captainMemberId) : null;

  const handleOpenReferrals = (round, tableMembers) => {
    setActiveRound(round);
    setModalMembers(tableMembers);
    setIsModalOpen(true);
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    loadData(false); // reload quietly
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-bni-red rounded flex items-center justify-center mr-3">
                <span className="text-white font-bold text-xs">BNI</span>
              </div>
              <span className="text-lg font-bold text-gray-900">Captain Portal</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 font-medium hidden sm:block">
                Welcome, {currentUser?.username}
              </span>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full print:p-0 print:m-0 print:w-full print:max-w-none">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 print:space-y-4"
          >
            {/* Selection Card - Hidden on Print */}
            <Card className="border-blue-100 shadow-md print:hidden">
              <CardContent className="p-6 md:p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <Search className="w-5 h-5 mr-2 text-blue-600" />
                  Select Your Table
                </h2>
                <div className="max-w-md">
                  <select
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-bni-red focus:ring-bni-red sm:text-sm p-3 border cursor-pointer"
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                  >
                    <option value="">-- Choose your table --</option>
                    {tables.map(t => {
                      const cap = getMember(t.captainMemberId);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.tableName} {cap ? `(Captain: ${cap.memberName})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </CardContent>
            </Card>

            {selectedTable && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0 print:mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Matrix for {selectedTable.tableName}
                    </h3>
                    <p className="text-gray-500 mt-1">
                      Captain: <span className="font-semibold text-gray-900">{captain ? captain.memberName : 'No Captain Assigned'}</span>
                    </p>
                  </div>
                  <div className="mt-4 sm:mt-0 print:hidden">
                    <Button variant="outline" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Schedule
                    </Button>
                  </div>
                </div>

                {rounds.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center print:hidden">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No Rounds Available</h3>
                    <p className="text-gray-500">The admin has not generated any seating rounds yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
                    {rounds.map(round => {
                      const isActive = !!round.allocations[selectedTable.id];
                      const participantIds = round.allocations[selectedTable.id] || [];
                      const participants = participantIds.map(getMember).filter(Boolean);
                      const allTableMembers = captain ? [captain, ...participants] : participants;
                      
                      // Count total referrals marked for this round on this table
                      const referralsData = round.referrals?.[selectedTable.id] || {};
                      let totalReferrals = 0;
                      Object.values(referralsData).forEach(arr => {
                        totalReferrals += arr.length;
                      });

                      return (
                        <Card key={round.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow print:shadow-none print:break-inside-avoid flex flex-col">
                          <CardHeader className="py-4 px-5 border-b border-gray-100 bg-gray-50/50 print:bg-gray-100 flex flex-row items-center justify-between">
                            <span className="font-bold text-lg text-gray-900">Round {round.roundNumber}</span>
                            {isActive && (
                              <div className="flex items-center space-x-2">
                                {totalReferrals > 0 && (
                                  <span className="text-xs font-bold bg-green-100 border border-green-200 text-green-700 px-2.5 py-1 rounded-full print:border-gray-300">
                                    {totalReferrals} Referrals
                                  </span>
                                )}
                                <span className="text-xs font-medium bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full print:border-gray-300">
                                  {participants.length} Participants
                                </span>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="p-0 flex-1 flex flex-col">
                            {!isActive ? (
                              <div className="p-8 text-center flex flex-col items-center justify-center text-gray-500 italic bg-gray-50 flex-1">
                                <span className="text-sm">Table closed for this round.</span>
                                <span className="text-xs mt-1">Captain participated elsewhere.</span>
                              </div>
                            ) : participants.length === 0 ? (
                              <div className="p-8 text-center text-gray-400 italic flex-1">
                                No participants assigned.
                              </div>
                            ) : (
                              <>
                                <ul className="divide-y divide-gray-50 print:divide-gray-200 flex-1">
                                  {participants.map((p, idx) => (
                                    <li key={p.id} className="px-5 py-4 hover:bg-gray-50 transition-colors flex items-start">
                                      <div className="w-6 h-6 rounded-full bg-gray-100 print:bg-gray-200 print:text-gray-900 text-gray-500 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 shrink-0">
                                        {idx + 1}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900">{p.memberName || 'Unnamed Member'}</span>
                                        <div className="flex items-center text-xs text-gray-500 print:text-gray-700 mt-1 space-x-2">
                                          <span className="font-mono bg-gray-100 print:bg-transparent print:border print:border-gray-300 px-1.5 py-0.5 rounded">{p.memberCode}</span>
                                          <span>•</span>
                                          <span className="truncate">{p.chapter || 'No Chapter'}</span>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                                <div className="p-4 border-t border-gray-100 bg-gray-50 print:hidden shrink-0 mt-auto">
                                  <Button 
                                    className="w-full bg-green-600 hover:bg-green-700 border-none"
                                    onClick={() => handleOpenReferrals(round, allTableMembers)}
                                  >
                                    <Handshake className="w-4 h-4 mr-2" />
                                    {totalReferrals > 0 ? 'Edit Referrals' : 'Mark Referrals'}
                                  </Button>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </main>
      
      <ReferralModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        round={activeRound}
        tableId={selectedTableId}
        membersAtTable={modalMembers}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
