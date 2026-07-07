import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { hashPassword } from '../utils/crypto';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for session
    const storedUser = localStorage.getItem('bni_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  async function login(username, password) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('User not found');
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Ensure user is active
      if (userData.status === 'Inactive') {
        throw new Error('User account is inactive. Contact Administrator.');
      }

      // Hash password and compare
      const hashedPassword = await hashPassword(password);
      
      if (userData.password !== hashedPassword) {
        throw new Error('Incorrect password');
      }

      // Login successful
      const user = {
        userId: userDoc.id,
        username: userData.username,
        role: userData.role,
        memberId: userData.memberId || null
      };

      setCurrentUser(user);
      localStorage.setItem('bni_user', JSON.stringify(user));
      return user;

    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  function logout() {
    setCurrentUser(null);
    localStorage.removeItem('bni_user');
  }

  const value = {
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
