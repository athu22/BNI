import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, Shield, ShieldCheck } from 'lucide-react';
import { collection, getDocs, doc, setDoc, query, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { hashPassword } from '../../utils/crypto';
import UserFormModal from './UserFormModal';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'members'))
      ]);

      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMembers(membersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (formData) => {
    try {
      // Check if username exists
      const q = query(collection(db, 'users'), where('username', '==', formData.username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("Username already exists!");
        return false;
      }

      // Check if member already has an account
      const memberQ = query(collection(db, 'users'), where('memberId', '==', formData.memberId));
      const memberSnap = await getDocs(memberQ);
      if (!memberSnap.empty && formData.memberId) {
        alert("This member already has an account!");
        return false;
      }

      const hashedPassword = await hashPassword(formData.password);
      const newUserRef = doc(collection(db, 'users'));
      
      await setDoc(newUserRef, {
        username: formData.username,
        password: hashedPassword,
        memberId: formData.memberId,
        role: formData.role,
        status: 'Active',
        createdAt: new Date()
      });

      fetchData();
      return true;
    } catch (err) {
      console.error(err);
      alert("Failed to create user.");
      return false;
    }
  };

  const toggleStatus = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(u => u.id !== userId));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage system access for Admin and Captains.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search by username..."
              className="pl-9 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Username</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Linked Member</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">Loading...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No users found.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const linkedMember = members.find(m => m.id === user.memberId);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{user.username}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === 'Admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role === 'Admin' ? <ShieldCheck className="w-3 h-3 mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {linkedMember ? linkedMember.name : <span className="text-gray-400 italic">None</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button 
                            onClick={() => toggleStatus(user.id, user.status)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isModalOpen && (
        <UserFormModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateUser}
          members={members}
        />
      )}
    </div>
  );
}
