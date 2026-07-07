import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import {
  Plus, Trash2, Users as UsersIcon, ShieldCheck, Download, RefreshCw, Layers, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, doc, deleteDoc, setDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import { generateRoundAssignments } from '../../utils/shuffler';

export default function Rounds() {
  const [rounds, setRounds] = useState([]);
  const [tables, setTables] = useState([]);
  const [members, setMembers] = useState([]);

  const [selectedRound, setSelectedRound] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [printMode, setPrintMode] = useState('matrix'); // 'matrix' or 'slips'

  const { success, error } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Rounds
      const roundsQuery = query(collection(db, 'rounds'), orderBy('roundNumber', 'asc'));
      const roundsSnap = await getDocs(roundsQuery);
      const roundsData = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch Tables
      const tablesSnap = await getDocs(collection(db, 'tables'));
      const tablesData = tablesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      tablesData.sort((a, b) => {
        return a.tableName.localeCompare(b.tableName, undefined, { numeric: true, sensitivity: 'base' });
      });

      // 3. Fetch Active Members
      const membersQuery = query(collection(db, 'members'));
      const membersSnap = await getDocs(membersQuery);
      const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setRounds(roundsData);
      setTables(tablesData);
      setMembers(membersData);

      if (roundsData.length > 0) {
        setSelectedRound(roundsData[roundsData.length - 1]);
      }
    } catch (err) {
      console.error(err);
      error("Failed to load rounds data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateRound = async () => {
    if (tables.length === 0) {
      error("You must create Tables before generating a round.");
      return;
    }

    setGenerating(true);
    try {
      // Small timeout to allow UI to update to loading state
      await new Promise(resolve => setTimeout(resolve, 500));

      const nextRoundNum = rounds.length > 0 ? rounds[rounds.length - 1].roundNumber + 1 : 1;

      // Run the Shuffler!
      const result = generateRoundAssignments(tables, members, rounds);

      const newRound = {
        roundNumber: nextRoundNum,
        allocations: result.allocations,
        penaltyScore: result.penaltyScore,
        createdAt: new Date().toISOString()
      };

      const roundRef = doc(collection(db, 'rounds'), `round_${nextRoundNum}_${Date.now()}`);
      await setDoc(roundRef, newRound);

      success(`Round ${nextRoundNum} generated successfully! ${result.isPerfect ? 'Perfect shuffle achieved.' : 'Note: Some minor overlap may occur due to numbers.'}`);

      fetchData();
    } catch (err) {
      console.error(err);
      error(err.message || "Failed to generate round.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteRound = async (roundId) => {
    if (!window.confirm("Are you sure you want to delete this round? If you have printed lists, they will be invalid.")) return;
    try {
      await deleteDoc(doc(db, 'rounds', roundId));
      success("Round deleted.");
      fetchData();
    } catch (err) {
      error("Failed to delete round.");
    }
  };

  // Helper to get member details
  const getMember = (id) => members.find(m => m.id === id);

  // Helper to get all slip data
  const getSlipData = () => {
    const assignments = {};
    members.forEach(m => assignments[m.id] = {});

    rounds.forEach(round => {
      const allocs = round.allocations || {};
      for (const [tableId, memberIds] of Object.entries(allocs)) {
        const table = tables.find(t => t.id === tableId);
        if (!table) continue;
        
        if (table.captainMemberId && assignments[table.captainMemberId]) {
          assignments[table.captainMemberId][round.roundNumber] = table.tableName;
        }

        memberIds.forEach(id => {
          if (assignments[id]) {
            assignments[id][round.roundNumber] = table.tableName;
          }
        });
      }
    });

    const sortedMembers = [...members].sort((a, b) => {
      const aCode = a.memberCode || '';
      const bCode = b.memberCode || '';
      if (!aCode && !bCode) return 0;
      if (!aCode) return 1;
      if (!bCode) return -1;
      const prefixOrder = { 'S': 1, 'N': 2, 'E': 3 };
      const aPrefix = aCode.charAt(0).toUpperCase();
      const bPrefix = bCode.charAt(0).toUpperCase();
      const aOrder = prefixOrder[aPrefix] || 99;
      const bOrder = prefixOrder[bPrefix] || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aNum = parseInt(aCode.substring(1), 10) || 0;
      const bNum = parseInt(bCode.substring(1), 10) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return aCode.localeCompare(bCode);
    });

    return { sortedMembers, assignments };
  };

  const handlePrintMatrix = () => {
    setPrintMode('matrix');
    setTimeout(() => window.print(), 100);
  };

  const handlePrintSlips = () => {
    setPrintMode('slips');
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Rounds & Matrix</h1>
          <p className="text-sm text-gray-500">Generate intelligent seating matrices for 1-2-1 meetings.</p>
        </div>
        <div className="flex items-center shrink-0">
          <Button onClick={handleGenerateRound} isLoading={generating} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Generate Next Round
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 print:hidden">
          <Skeleton className="h-12 w-full max-w-sm rounded-lg" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : rounds.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center print:hidden">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Rounds Generated</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            When you're ready, generate Round 1. The system will automatically shuffle participants across your tables.
          </p>
          <Button onClick={handleGenerateRound} isLoading={generating}>
            Generate Round 1
          </Button>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {/* Round Selector */}
          <div className="flex flex-wrap gap-2 print:hidden">
            {rounds.map(round => (
              <button
                key={round.id}
                onClick={() => setSelectedRound(round)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedRound?.id === round.id
                    ? 'bg-bni-red text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
              >
                Round {round.roundNumber}
              </button>
            ))}
          </div>

          {/* Selected Round View */}
          {selectedRound && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none print:rounded-none">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 print:hidden">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Round {selectedRound.roundNumber} Assignments</h2>
                  <p className="text-xs text-gray-500">
                    Generated on {new Date(selectedRound.createdAt).toLocaleString()}
                    {selectedRound.penaltyScore > 0 && <span className="text-amber-500 ml-2">(Minor overlaps exist)</span>}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="text-gray-600 hover:text-gray-900 border-gray-200" onClick={handlePrintMatrix}>
                    <Printer className="w-4 h-4 mr-2" /> Print Matrix
                  </Button>
                  <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200" onClick={handlePrintSlips}>
                    <Printer className="w-4 h-4 mr-2" /> Print Slips (All Rounds)
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleDeleteRound(selectedRound.id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Round
                  </Button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:hidden">
                {tables.map(table => {
                  const captain = getMember(table.captainMemberId);
                  const participantIds = selectedRound.allocations[table.id] || [];
                  const participants = participantIds.map(getMember).filter(Boolean);

                  return (
                    <Card key={table.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <CardHeader className="py-3 px-4 border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between">
                        <span className="font-bold text-gray-900">{table.tableName}</span>
                        <span className="text-xs font-medium bg-white px-2 py-1 rounded border border-gray-200 text-gray-600">
                          {participants.length + (captain ? 1 : 0)} Total
                        </span>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ul className="divide-y divide-gray-50 text-sm">
                          {/* Captain Row */}
                          <li className="px-4 py-3 bg-blue-50/30 flex items-center">
                            <ShieldCheck className="w-4 h-4 text-bni-red mr-3 shrink-0" />
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900">
                                {captain ? captain.memberName : 'No Captain Assigned'}
                              </span>
                              {captain && (
                                <span className="text-xs text-gray-500 font-mono mt-0.5">
                                  {captain.memberCode} • {captain.chapter}
                                </span>
                              )}
                            </div>
                            {captain && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Captain</span>}
                          </li>

                          {/* Participant Rows */}
                          {participants.length === 0 ? (
                            <li className="px-4 py-4 text-center text-gray-400 italic">No participants assigned</li>
                          ) : (
                            participants.map((p, idx) => (
                              <li key={p.id} className="px-4 py-3 flex items-center hover:bg-gray-50 transition-colors">
                                <span className="w-5 text-gray-400 text-xs font-medium">{idx + 1}.</span>
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-700">{p.memberName || 'Unnamed Member'}</span>
                                  <span className="text-xs text-gray-500 font-mono mt-0.5">
                                    {p.memberCode} • {p.chapter}
                                  </span>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Printable Table View (Matrix) */}
              {printMode === 'matrix' && (
                <div className="hidden print:block p-2">
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Round {selectedRound.roundNumber} Matrix</h1>
                    <p className="text-gray-500 text-sm mt-1">Generated on {new Date(selectedRound.createdAt).toLocaleString()}</p>
                  </div>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100 print:bg-gray-200">
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-900">Table Name</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-bold text-gray-900 w-16">Sr No</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-900">Role</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-900">Member Code</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-900">Member Name</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold text-gray-900">Chapter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tables.map(table => {
                        const captain = getMember(table.captainMemberId);
                        const participantIds = selectedRound.allocations[table.id] || [];
                        const participants = participantIds.map(getMember).filter(Boolean);
                        const totalRows = (captain ? 1 : 0) + participants.length;
                        
                        if (totalRows === 0) {
                          return (
                            <tr key={table.id}>
                              <td className="border border-gray-300 px-3 py-2 font-bold text-gray-900">{table.tableName}</td>
                              <td className="border border-gray-300 px-3 py-2 text-center text-gray-500 italic" colSpan="5">No participants assigned</td>
                            </tr>
                          );
                        }

                        return (
                          <React.Fragment key={table.id}>
                            {captain && (
                              <tr>
                                <td className="border border-gray-300 px-3 py-2 font-bold text-gray-900 bg-gray-50 align-top" rowSpan={totalRows}>
                                  {table.tableName}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center">1</td>
                                <td className="border border-gray-300 px-3 py-2 font-semibold text-blue-700 bg-blue-50/50">Captain</td>
                                <td className="border border-gray-300 px-3 py-2 font-mono text-gray-700">{captain.memberCode}</td>
                                <td className="border border-gray-300 px-3 py-2 font-medium text-gray-900">{captain.memberName || '-'}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-600">{captain.chapter || '-'}</td>
                              </tr>
                            )}
                            {participants.map((p, idx) => (
                              <tr key={p.id}>
                                {!captain && idx === 0 && (
                                  <td className="border border-gray-300 px-3 py-2 font-bold text-gray-900 bg-gray-50 align-top" rowSpan={totalRows}>
                                    {table.tableName}
                                  </td>
                                )}
                                <td className="border border-gray-300 px-3 py-2 text-center">{captain ? idx + 2 : idx + 1}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-600">Member</td>
                                <td className="border border-gray-300 px-3 py-2 font-mono text-gray-700">{p.memberCode}</td>
                                <td className="border border-gray-300 px-3 py-2 font-medium text-gray-900">{p.memberName || '-'}</td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-600">{p.chapter || '-'}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Printable Slips View */}
              {printMode === 'slips' && (
                <div className="hidden print:block p-0 m-0">
                  <div className="grid grid-cols-2 w-full">
                    {(() => {
                      const { sortedMembers, assignments } = getSlipData();
                      return sortedMembers.map((member, idx) => {
                        const mAssign = assignments[member.id] || {};
                        
                        return (
                          <div 
                            key={member.id} 
                            className="h-[25mm] box-border p-2 m-0.5 border border-dashed border-gray-800 flex flex-col justify-center"
                            style={{ 
                              pageBreakInside: 'avoid',
                              // Force a page break every 20 slips (10 rows of 2 columns)
                              pageBreakAfter: (idx + 1) % 20 === 0 ? 'always' : 'auto' 
                            }}
                          >
                            <div className="flex justify-between items-center border-b border-gray-200 pb-1 mb-1.5">
                              <span className="font-bold text-lg leading-none tracking-tight text-gray-900">{member.memberCode}</span>
                              <span className="font-bold text-sm leading-none truncate ml-2 uppercase text-gray-800">{member.memberName}</span>
                            </div>
                            <div className="flex justify-between items-center px-1">
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-gray-500 font-semibold mb-0.5">R1</span>
                                <span className="text-xs font-bold text-gray-900">{mAssign[1] || '-'}</span>
                              </div>
                              <div className="flex flex-col items-center border-l border-r border-gray-200 px-4">
                                <span className="text-[10px] text-gray-500 font-semibold mb-0.5">R2</span>
                                <span className="text-xs font-bold text-gray-900">{mAssign[2] || '-'}</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-gray-500 font-semibold mb-0.5">R3</span>
                                <span className="text-xs font-bold text-gray-900">{mAssign[3] || '-'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
