// /src/components/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';
import { packages } from '../data/packages';

export default function AdminPanel({ bookings, onDelete }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleVerify = async (userId, verified) => {
    await updateDoc(doc(db, 'users', userId), { verified });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Admin Panel</h2>
      <h3 className="text-xl font-semibold mb-2">Users</h3>
      <table className="w-full text-left mb-8">
        <thead>
          <tr className="border-b">
            <th className="p-2">Email</th>
            <th className="p-2">Child Name</th>
            <th className="p-2">Package</th>
            <th className="p-2">Verified</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const pkg = packages.find(p => p.id === u.packageId);
            return (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.childName}</td>
                <td className="p-2">{pkg ? pkg.name : '-'}</td>
                <td className="p-2">{u.verified ? 'Yes' : 'No'}</td>
                <td className="p-2">
                  {u.verified ? (
                    <button onClick={() => handleVerify(u.id, false)} className="bg-yellow-500 text-white px-2 py-1 rounded">Unverify</button>
                  ) : (
                    <button onClick={() => handleVerify(u.id, true)} className="bg-green-600 text-white px-2 py-1 rounded">Verify</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3 className="text-xl font-semibold mb-2">Bookings</h3>
      {bookings.length === 0 ? (
        <p className="text-center text-gray-600">No sessions booked yet.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">Child</th>
              <th className="p-2">Grade</th>
              <th className="p-2">Course</th>
              <th className="p-2">Day</th>
              <th className="p-2">Time</th>
              <th className="p-2">Duration</th>
              <th className="p-2">Tutor</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-2">{b.child}</td>
                <td className="p-2">{b.grade}</td>
                <td className="p-2">{b.course}</td>
                <td className="p-2">{b.day}</td>
                <td className="p-2">{b.time}</td>
                <td className="p-2">{b.duration} mins</td>
                <td className="p-2">{b.tutor}</td>
                <td className="p-2">
                  <button onClick={() => onDelete(b.id)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}