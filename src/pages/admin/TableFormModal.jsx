import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastContext';

export default function TableFormModal({ isOpen, onClose, table, captains, onSuccess }) {
  const [formData, setFormData] = useState({
    tableName: '',
    captainMemberId: ''
  });
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    if (table) {
      setFormData({
        tableName: table.tableName || '',
        captainMemberId: table.captainMemberId || ''
      });
    } else {
      setFormData({
        tableName: '',
        captainMemberId: ''
      });
    }
  }, [table]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const nameStr = formData.tableName.trim();

      if (table) {
        // Edit
        await updateDoc(doc(db, 'tables', table.id), {
          ...formData,
          tableName: nameStr,
          updatedAt: new Date().toISOString()
        });
        success("Table updated successfully.");
      } else {
        // Add
        const tablesRef = collection(db, 'tables');
        const newRef = doc(tablesRef);
        await setDoc(newRef, {
          ...formData,
          tableName: nameStr,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        success("Table created successfully.");
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      error("Failed to save table details.");
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-semibold text-gray-900">
            {table ? 'Edit Table' : 'Create New Table'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="table-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Table Name / Number *"
            placeholder="e.g. Table 1"
            value={formData.tableName}
            onChange={(e) => setFormData({...formData, tableName: e.target.value})}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Captain (Optional)</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bni-red bg-white"
              value={formData.captainMemberId}
              onChange={(e) => setFormData({...formData, captainMemberId: e.target.value})}
            >
              <option value="">-- No Captain Assigned --</option>
              {captains.map(c => (
                <option key={c.id} value={c.id}>{c.memberName} ({c.chapter})</option>
              ))}
            </select>
          </div>
        </form>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3 shrink-0">
          <Button variant="outline" onClick={onClose} className="w-24">Cancel</Button>
          <Button type="submit" form="table-form" isLoading={loading} className="min-w-[120px]">
            {table ? 'Save Changes' : 'Create Table'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
