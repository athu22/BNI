import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { 
  Search, Upload, Download, Building2,
  UserCheck, Plus, Trash2, Edit, ShieldCheck, Shield, ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, getDocs, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';
import ExcelImportModal from '../../components/ExcelImportModal';
import * as XLSX from 'xlsx';
import MemberFormModal from './MemberFormModal'; 

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [chapterFilter, setChapterFilter] = useState('');
  const [captainFilter, setCaptainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { toast, success, error } = useToast();

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'members'));
      const membersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Custom sorting: S -> N -> E, then numerical ascending
      membersData.sort((a, b) => {
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

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        const aNum = parseInt(aCode.substring(1), 10) || 0;
        const bNum = parseInt(bCode.substring(1), 10) || 0;

        if (aNum !== bNum) {
          return aNum - bNum;
        }
        
        return aCode.localeCompare(bCode);
      });
      
      setMembers(membersData);
    } catch (err) {
      console.error("Failed to fetch members", err);
      error("Failed to load members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Compute unique chapters for filter dropdown
  const uniqueChapters = useMemo(() => {
    const chapters = new Set(members.map(m => m.chapter).filter(Boolean));
    return Array.from(chapters).sort();
  }, [members]);

  // Filter and Search Logic
  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      // Search
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (member.memberName?.toLowerCase() || '').includes(search) ||
        (member.memberCode?.toLowerCase() || '').includes(search) ||
        (member.chapter?.toLowerCase() || '').includes(search);

      // Filters
      const matchesChapter = chapterFilter ? member.chapter === chapterFilter : true;
      const matchesCaptain = captainFilter ? (captainFilter === 'yes' ? member.isCaptain === true : member.isCaptain === false) : true;
      const matchesStatus = statusFilter ? member.status === statusFilter : true;

      return matchesSearch && matchesChapter && matchesCaptain && matchesStatus;
    });
  }, [members, searchTerm, chapterFilter, captainFilter, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const currentMembers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMembers.slice(start, start + itemsPerPage);
  }, [filteredMembers, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, chapterFilter, captainFilter, statusFilter]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(currentMembers.map(m => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} member(s)?`)) return;
    
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, 'members', id);
        batch.delete(ref);
      });
      await batch.commit();
      success(`Successfully deleted ${selectedIds.length} member(s).`);
      setSelectedIds([]);
      fetchMembers();
    } catch (err) {
      console.error(err);
      error("Failed to delete selected members.");
    }
  };

  const handleExport = () => {
    if (filteredMembers.length === 0) {
      toast("No records to export", "info");
      return;
    }
    
    const exportData = filteredMembers.map((m, index) => ({
      'Sr. No.': index + 1,
      'Member Code': m.memberCode,
      'Member Name': m.memberName,
      'Chapter': m.chapter,
      'Captain': m.isCaptain ? 'Yes' : 'No',
      'Status': m.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Members");
    XLSX.writeFile(workbook, "BNI_Members_Export.xlsx");
    success("Export downloaded successfully!");
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      await updateDoc(doc(db, 'members', id), { status: newStatus, updatedAt: new Date().toISOString() });
      setMembers(members.map(m => m.id === id ? { ...m, status: newStatus } : m));
      success(`Member marked as ${newStatus}`);
    } catch (err) {
      error("Failed to update status.");
    }
  };
  
  const toggleCaptain = async (id, currentCaptainStatus) => {
    try {
      const newStatus = !currentCaptainStatus;
      await updateDoc(doc(db, 'members', id), { isCaptain: newStatus, updatedAt: new Date().toISOString() });
      setMembers(members.map(m => m.id === id ? { ...m, isCaptain: newStatus } : m));
      success(newStatus ? 'Member designated as Captain' : 'Captain role removed');
    } catch (err) {
      error("Failed to update Captain status.");
    }
  };

  const handleDeleteSingle = async (id) => {
    if (!window.confirm("Are you sure you want to delete this member?")) return;
    try {
      await deleteDoc(doc(db, 'members', id));
      setMembers(members.filter(m => m.id !== id));
      success("Member deleted.");
    } catch (err) {
      error("Failed to delete member.");
    }
  };

  const handleAddClick = () => {
    setEditingMember(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (member) => {
    setEditingMember(member);
    setIsFormModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Member List</h1>
          <p className="text-sm text-gray-500">Manage imported members and table allocations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDeleteSelected}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedIds.length})
            </Button>
          )}
          <Button variant="secondary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={handleAddClick}>
            <Plus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 pb-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search code, name, chapter..."
                className="pl-9 w-full bg-gray-50/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <select 
                className="h-10 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bni-red text-gray-700 min-w-[140px]"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
              >
                <option value="">All Chapters</option>
                {uniqueChapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select 
                className="h-10 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bni-red text-gray-700 min-w-[130px]"
                value={captainFilter}
                onChange={(e) => setCaptainFilter(e.target.value)}
              >
                <option value="">All Captains</option>
                <option value="yes">Captain (Yes)</option>
                <option value="no">Captain (No)</option>
              </select>

              <select 
                className="h-10 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bni-red text-gray-700 min-w-[120px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto relative">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 backdrop-blur-md border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 w-12">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-bni-red focus:ring-bni-red"
                      checked={currentMembers.length > 0 && selectedIds.length === currentMembers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-4 font-medium">Sr. No.</th>
                  <th className="px-4 py-4 font-medium">Member Code</th>
                  <th className="px-4 py-4 font-medium">Member Name</th>
                  <th className="px-4 py-4 font-medium">Chapter</th>
                  <th className="px-4 py-4 font-medium text-center">Captain</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-4" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-4 text-center"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-4"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : currentMembers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No members found</h3>
                        <p className="text-gray-500 max-w-sm">
                          Try adjusting your search or filters, or import a new Excel file.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentMembers.map((member, i) => (
                    <motion.tr
                      key={member.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(member.id) ? 'bg-red-50/30' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-bni-red focus:ring-bni-red"
                          checked={selectedIds.includes(member.id)}
                          onChange={() => toggleSelection(member.id)}
                        />
                      </td>
                      <td className="px-4 py-4 text-gray-500 font-medium">
                         {(currentPage - 1) * itemsPerPage + i + 1}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">{member.memberCode}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900">{member.memberName}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center text-gray-700">
                          <Building2 className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                          <span className="font-medium">{member.chapter}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {member.isCaptain ? (
                          <div className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 shadow-sm mx-auto">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                            YES
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs font-medium">NO</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={member.status === 'Active' ? 'success' : 'default'}>
                          {member.status || 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                          <button 
                            title={member.isCaptain ? "Remove Captain" : "Make Captain"}
                            onClick={() => toggleCaptain(member.id, member.isCaptain)}
                            className={`p-1.5 rounded-md transition-colors ${member.isCaptain ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button 
                            title="Edit"
                            onClick={() => handleEditClick(member)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            title={member.status === 'Active' ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleStatus(member.id, member.status)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button 
                            title="Delete"
                            onClick={() => handleDeleteSingle(member.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * itemsPerPage, filteredMembers.length)}</span> of <span className="font-medium text-gray-900">{filteredMembers.length}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-sm font-medium px-2 text-gray-700">
                  {currentPage} / {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isImportModalOpen && (
        <ExcelImportModal 
          isOpen={isImportModalOpen} 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={() => {
            setIsImportModalOpen(false);
            fetchMembers();
          }}
        />
      )}
      
      {isFormModalOpen && (
        <MemberFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          member={editingMember}
          onSuccess={() => {
            setIsFormModalOpen(false);
            fetchMembers();
          }}
        />
      )}
    </div>
  );
}
