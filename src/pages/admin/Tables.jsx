import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { 
  Plus, Trash2, Edit, Users as UsersIcon, ShieldCheck, Handshake, Eye, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, doc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import TableFormModal from './TableFormModal';

function TableDetailsModal({ isOpen, onClose, table, rounds, members }) {
  if (!isOpen || !table) return null;

  const getMemberName = (id) => {
    const m = members.find(x => x.id === id);
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{table.tableName} - Referral Details</h2>
                <p className="text-sm text-gray-500 mt-1">Detailed breakdown of who gave referrals to whom.</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 space-y-6 bg-gray-50/30">
              {rounds.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
                  <p className="text-gray-500 italic">No rounds available yet.</p>
                </div>
              ) : (
                rounds.map(round => {
                  const refs = round.referrals?.[table.id] || {};
                  
                  // Build receiver -> givers map for display
                  const receiverMap = {};
                  let total = 0;
                  
                  Object.entries(refs).forEach(([giverId, receivers]) => {
                    receivers.forEach(recId => {
                      if (!receiverMap[recId]) receiverMap[recId] = [];
                      receiverMap[recId].push(giverId);
                      total++;
                    });
                  });
                  const receiversList = Object.keys(receiverMap);

                  return (
                    <div key={round.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-lg text-gray-900">Round {round.roundNumber}</span>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${total > 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                          {total} Referrals
                        </span>
                      </div>
                      <div className="p-5">
                        {total === 0 ? (
                          <p className="text-sm text-gray-400 italic text-center py-6">No referrals recorded for this table in Round {round.roundNumber}.</p>
                        ) : (
                          <div className="space-y-4">
                            {receiversList.map(recId => {
                              const giversList = receiverMap[recId];
                              return (
                                <div key={recId} className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors shadow-sm">
                                  <div className="font-semibold text-gray-900 sm:w-1/3 shrink-0 flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mr-3 font-bold text-sm">
                                      {getMemberName(recId).charAt(0)}
                                    </div>
                                    <span className="truncate">{getMemberName(recId)}</span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Received referral from</div>
                                    <div className="flex flex-wrap gap-2">
                                      {giversList.map(giverId => (
                                        <span key={giverId} className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center shadow-sm">
                                          {getMemberName(giverId)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [members, setMembers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [detailsTable, setDetailsTable] = useState(null);

  const { success, error } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Tables
      const tablesSnap = await getDocs(collection(db, 'tables'));
      const tablesData = tablesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      tablesData.sort((a, b) => {
        return a.tableName.localeCompare(b.tableName, undefined, { numeric: true, sensitivity: 'base' });
      });

      // Fetch Captains (Members where isCaptain == true)
      const capQuery = query(collection(db, 'members'), where('isCaptain', '==', true));
      const capSnap = await getDocs(capQuery);
      const capData = capSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch All Members (needed for resolving names in details)
      const membersSnap = await getDocs(collection(db, 'members'));
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Fetch Rounds for stats
      const roundsQuery = query(collection(db, 'rounds'), orderBy('roundNumber', 'asc'));
      const roundsSnap = await getDocs(roundsQuery);
      const roundsData = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setTables(tablesData);
      setCaptains(capData);
      setMembers(membersData);
      setRounds(roundsData);
    } catch (err) {
      console.error(err);
      error("Failed to load tables data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this table?")) return;
    try {
      await deleteDoc(doc(db, 'tables', id));
      setTables(tables.filter(t => t.id !== id));
      success("Table deleted.");
    } catch (err) {
      error("Failed to delete table.");
    }
  };

  const handleAddClick = () => {
    setEditingTable(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (table) => {
    setEditingTable(table);
    setIsFormModalOpen(true);
  };

  const getCaptainDetails = (captainId) => {
    if (!captainId) return null;
    return captains.find(c => c.id === captainId);
  };

  // Calculate Global Totals
  let globalTotals = { total: 0 };
  rounds.forEach(round => {
    globalTotals[`R${round.roundNumber}`] = 0;
    if (round.referrals) {
      Object.keys(round.referrals).forEach(tableId => {
        let count = 0;
        Object.values(round.referrals[tableId]).forEach(arr => {
          count += arr.length;
        });
        globalTotals[`R${round.roundNumber}`] += count;
        globalTotals.total += count;
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Table Management</h1>
          <p className="text-sm text-gray-500">Create tables, assign Captains, and monitor referral performance.</p>
        </div>
        <div className="flex items-center shrink-0">
          <Button onClick={handleAddClick}>
            <Plus className="w-4 h-4 mr-2" />
            Create Table
          </Button>
        </div>
      </div>

      {/* Global Summary */}
      {!loading && rounds.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-wrap gap-6 items-center">
          <div className="flex items-center space-x-4 pr-8 border-r border-gray-100">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <Handshake className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Grand Total Referrals</p>
              <p className="text-4xl font-extrabold text-gray-900 leading-none">{globalTotals.total}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            {rounds.map(r => (
              <div key={r.id} className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Round {r.roundNumber}</p>
                <p className="text-2xl font-bold text-gray-800 leading-none">{globalTotals[`R${r.roundNumber}`] || 0}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-4 w-48 mb-6" />
              <div className="flex justify-between">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
            <UsersIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Tables Created</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            You haven't created any tables yet. Create a table to start assigning captains.
          </p>
          <Button onClick={handleAddClick}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Table
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map((table, i) => {
            const cap = getCaptainDetails(table.captainMemberId);
            
            // Calculate table stats
            let tableTotal = 0;
            const tableRounds = rounds.map(round => {
              let count = 0;
              if (round.referrals && round.referrals[table.id]) {
                Object.values(round.referrals[table.id]).forEach(arr => {
                  count += arr.length;
                });
              }
              tableTotal += count;
              return { roundNumber: round.roundNumber, count };
            });
            
            return (
              <motion.div
                key={table.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col relative overflow-hidden group"
              >
                {/* Subtle red accent line at the top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-bni-red to-red-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{table.tableName}</h3>
                    {tableTotal > 0 && (
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md border border-green-200">
                        {tableTotal} Refs
                      </span>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Assigned Captain</p>
                    {cap ? (
                      <div>
                        <div className="flex items-center text-gray-900 font-semibold mb-1 text-sm">
                          <ShieldCheck className="w-4 h-4 mr-2 text-bni-red shrink-0" />
                          <span className="truncate">{cap.memberName}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 ml-6">{cap.chapter}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">
                        No Captain assigned
                      </div>
                    )}
                  </div>

                  {rounds.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Referrals by Round</p>
                      <div className="grid grid-cols-3 gap-2">
                        {tableRounds.map(tr => (
                          <div key={tr.roundNumber} className="bg-white border border-gray-100 rounded-lg p-2 text-center shadow-sm">
                            <div className="text-[9px] text-gray-400 font-bold uppercase">R{tr.roundNumber}</div>
                            <div className={`text-sm font-bold ${tr.count > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              {tr.count}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                  <span className="text-[10px] text-gray-400 font-medium">
                    Created {new Date(table.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => setDetailsTable(table)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="View Referral Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEditClick(table)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Table"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(table.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Table"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {isFormModalOpen && (
        <TableFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          table={editingTable}
          captains={captains}
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchData();
          }}
        />
      )}

      <TableDetailsModal 
        isOpen={!!detailsTable}
        onClose={() => setDetailsTable(null)}
        table={detailsTable}
        rounds={rounds}
        members={members}
      />
    </div>
  );
}
