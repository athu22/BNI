import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

export default function MemberFormModal({ isOpen, onClose, member, onSuccess }) {
  const [formData, setFormData] = useState({
    memberCode: '',
    memberName: '',
    chapter: '',
    isCaptain: false
  });
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (member) {
      setFormData({
        memberCode: member.memberCode || '',
        memberName: member.memberName || '',
        chapter: member.chapter || '',
        isCaptain: member.isCaptain || false
      });
    } else {
      setFormData({
        memberCode: '',
        memberName: '',
        chapter: '',
        isCaptain: false
      });
    }
  }, [member]);

  if (!isOpen) return null;

  const generateMemberCode = () => {
    return 'M-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let codeStr = formData.memberCode.trim();
      const nameStr = formData.memberName.trim();
      const chapterStr = formData.chapter.trim();

      if (!codeStr) {
        codeStr = generateMemberCode();
      }

      // Check duplicates (excluding current member if editing)
      const membersRef = collection(db, 'members');
      const snap = await getDocs(membersRef);
      const existingMembers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const isCodeDuplicate = existingMembers.some(m => m.memberCode === codeStr && m.id !== member?.id);
      if (isCodeDuplicate) {
        error("A member with this code already exists.");
        setLoading(false);
        return;
      }

      const isNameDuplicate = nameStr !== '' && existingMembers.some(m => 
        m.memberName && m.memberName.toLowerCase() === nameStr.toLowerCase() && 
        m.chapter.toLowerCase() === chapterStr.toLowerCase() &&
        m.id !== member?.id
      );

      if (isNameDuplicate) {
        error("A member with this name already exists in this chapter.");
        setLoading(false);
        return;
      }

      if (member) {
        // Edit
        await updateDoc(doc(db, 'members', member.id), {
          ...formData,
          memberCode: codeStr,
          memberName: nameStr,
          chapter: chapterStr,
          updatedAt: new Date().toISOString()
        });
        success("Member updated successfully.");
      } else {
        // Add
        const newRef = doc(membersRef);
        await setDoc(newRef, {
          ...formData,
          memberCode: codeStr,
          memberName: nameStr,
          chapter: chapterStr,
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        success("Member added successfully.");
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      error("Failed to save member details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-semibold text-gray-900">
            {member ? 'Edit Member' : 'Add New Member'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          <form id="member-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Member Code"
                placeholder="e.g. E15 (Auto-generated if left empty)"
                value={formData.memberCode}
                onChange={(e) => setFormData({...formData, memberCode: e.target.value})}
              />
              <Input
                label="Member Name (Optional)"
                placeholder="Leave blank if unknown"
                value={formData.memberName}
                onChange={(e) => setFormData({...formData, memberName: e.target.value})}
              />
              <Input
                label="Chapter (Optional)"
                placeholder="Leave blank if unknown"
                value={formData.chapter}
                onChange={(e) => setFormData({...formData, chapter: e.target.value})}
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${formData.isCaptain ? 'bg-bni-red border-bni-red' : 'bg-gray-50 border-gray-300 group-hover:border-bni-red'}`}>
                  {formData.isCaptain && <Check className="w-4 h-4 text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={formData.isCaptain}
                  onChange={(e) => setFormData({...formData, isCaptain: e.target.checked})}
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 block">Is Captain?</span>
                  <span className="text-xs text-gray-500">Designate this member as a chapter captain.</span>
                </div>
              </label>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3 shrink-0">
          <Button variant="outline" onClick={onClose} className="w-24">Cancel</Button>
          <Button type="submit" form="member-form" isLoading={loading} className="min-w-[120px]">
            {member ? 'Save Changes' : 'Add Member'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
