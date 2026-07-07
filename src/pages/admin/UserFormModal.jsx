import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UserFormModal({ isOpen, onClose, onSubmit, members }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'Captain',
    memberId: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await onSubmit(formData);
    if (success) {
      onClose();
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Create New User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Username"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase()})}
            required
            autoComplete="off"
          />

          <Input
            label="Password"
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
            autoComplete="new-password"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bni-red"
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
            >
              <option value="Captain">Captain</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Create User</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
