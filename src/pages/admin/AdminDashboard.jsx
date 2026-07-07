import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/Card';
import { Users, UserCog } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminDashboard() {
  const [memberCount, setMemberCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const membersSnap = await getDocs(collection(db, 'members'));
        setMemberCount(membersSnap.size);

        const usersSnap = await getDocs(collection(db, 'users'));
        setUserCount(usersSnap.size);
      } catch (err) {
        console.error("Failed to fetch counts", err);
      }
    }
    fetchData();
  }, []);

  const stats = [
    { name: 'Total Imported Members', value: memberCount, icon: Users },
    { name: 'System Users', value: userCount, icon: UserCog }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of the system.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 truncate">{stat.name}</p>
                    <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <stat.icon className="w-6 h-6 text-bni-red" aria-hidden="true" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
