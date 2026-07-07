import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { hashPassword } from '../utils/crypto';

export default function SeedAdmin() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSeed = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setStatus('Checking for existing user...');
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.toLowerCase()));
      const snap = await getDocs(q);

      if (!snap.empty) {
        setStatus(`Error: Username '${username}' already exists.`);
        setLoading(false);
        return;
      }

      setStatus('Creating user...');
      
      const hashedPassword = await hashPassword(password);
      
      const newUserRef = doc(usersRef);
      await setDoc(newUserRef, {
        username: username.toLowerCase(),
        password: hashedPassword,
        role: 'Admin',
        status: 'Active',
        memberId: null,
        createdAt: new Date().toISOString()
      });
      
      setStatus('Super Admin account created successfully! You can now log in.');
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Seed Custom Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSeed} className="space-y-4">
            <Input 
              label="Admin Username" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
            <Input 
              label="Admin Password" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
            
            <Button type="submit" className="w-full" isLoading={loading}>
              Create Admin
            </Button>

            {status && (
              <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-md text-sm">
                {status}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
