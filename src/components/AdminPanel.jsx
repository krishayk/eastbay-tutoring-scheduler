// /src/components/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, updateDoc, doc, getDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { packages } from '../data/packages';

export default function AdminPanel({ bookings, onDelete }) {
  const [users, setUsers] = useState([]);
  const [userChildren, setUserChildren] = useState({});
  const [editingBooking, setEditingBooking] = useState(null);
  const [editBookingData, setEditBookingData] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch all children for all users
  useEffect(() => {
    const fetchAllChildren = async () => {
      const childrenSnap = await getDocs(collection(db, 'children'));
      const childrenByUser = {};
      childrenSnap.forEach(doc => {
        const data = doc.data();
        if (!childrenByUser[data.userId]) childrenByUser[data.userId] = [];
        childrenByUser[data.userId].push(data.name);
      });
      setUserChildren(childrenByUser);
    };
    fetchAllChildren();
  }, [users]);

  const handleVerify = async (userId, verified) => {
    await updateDoc(doc(db, 'users', userId), { verified });
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete the account for ${userEmail}? This cannot be undone.`)) return;
    try {
      // Delete all children
      const childrenSnap = await getDocs(query(collection(db, 'children'), where('userId', '==', userId)));
      for (const childDoc of childrenSnap.docs) {
        await deleteDoc(childDoc.ref);
      }
      // Delete all bookings
      const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('userId', '==', userId)));
      for (const bookingDoc of bookingsSnap.docs) {
        await deleteDoc(bookingDoc.ref);
      }
      // Delete user
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      alert('Failed to delete user.');
    }
  };

  const handleEditBooking = (booking) => {
    setEditingBooking(booking.id);
    setEditBookingData({ ...booking });
  };

  const handleSaveBooking = async (bookingId) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), editBookingData);
      setEditingBooking(null);
    } catch (error) {
      alert('Failed to update booking.');
    }
  };

  const handleDoneBooking = async (bookingId) => {
    if (!window.confirm('Mark this session as completed? This will remove it from active bookings.')) return;
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (error) {
      alert('Failed to mark session as completed.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Admin Panel</h2>
      <h3 className="text-xl font-semibold mb-2">Users</h3>
      <table className="w-full text-left mb-8">
        <thead>
          <tr className="border-b">
            <th className="p-2">Email</th>
            <th className="p-2">Parent Name</th>
            <th className="p-2">Parent Phone</th>
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
                <td className="p-2">{u.parentName || '-'}</td>
                <td className="p-2">{u.parentPhone || '-'}</td>
                <td className="p-2">{userChildren[u.id]?.join(', ') || '-'}</td>
                <td className="p-2">{pkg ? pkg.name : '-'}</td>
                <td className="p-2">{u.verified ? 'Yes' : 'No'}</td>
                <td className="p-2 flex gap-2">
                  {u.verified ? (
                    <button onClick={() => handleVerify(u.id, false)} className="bg-yellow-500 text-white px-2 py-1 rounded">Unverify</button>
                  ) : (
                    <button onClick={() => handleVerify(u.id, true)} className="bg-green-600 text-white px-2 py-1 rounded">Verify</button>
                  )}
                  <button onClick={() => handleDeleteUser(u.id, u.email)} className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Delete</button>
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
              <th className="p-2">Tutor</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t">
                {editingBooking === b.id ? (
                  <>
                    <td className="p-2"><input value={editBookingData.child} onChange={e => setEditBookingData({ ...editBookingData, child: e.target.value })} className="border rounded p-1 w-full" /></td>
                    <td className="p-2"><input value={editBookingData.grade} onChange={e => setEditBookingData({ ...editBookingData, grade: e.target.value })} className="border rounded p-1 w-full" /></td>
                    <td className="p-2"><input value={editBookingData.course} onChange={e => setEditBookingData({ ...editBookingData, course: e.target.value })} className="border rounded p-1 w-full" /></td>
                    <td className="p-2"><input value={editBookingData.day} onChange={e => setEditBookingData({ ...editBookingData, day: e.target.value })} className="border rounded p-1 w-full" /></td>
                    <td className="p-2"><input value={editBookingData.time} onChange={e => setEditBookingData({ ...editBookingData, time: e.target.value })} className="border rounded p-1 w-full" /></td>
                    <td className="p-2"><input value={editBookingData.tutor} onChange={e => setEditBookingData({ ...editBookingData, tutor: e.target.value })} className="border rounded p-1 w-full" /></td>
                    <td className="p-2 flex gap-2">
                      <button onClick={() => handleSaveBooking(b.id)} className="bg-green-600 text-white px-2 py-1 rounded">Save</button>
                      <button onClick={() => setEditingBooking(null)} className="bg-gray-300 text-gray-800 px-2 py-1 rounded">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2">{b.child}</td>
                    <td className="p-2">{b.grade}</td>
                    <td className="p-2">{b.course}</td>
                    <td className="p-2">{b.day}</td>
                    <td className="p-2">{b.time}</td>
                    <td className="p-2">{b.tutor}</td>
                    <td className="p-2 flex gap-2">
                      <button onClick={() => handleEditBooking(b)} className="bg-blue-500 text-white px-2 py-1 rounded">Edit</button>
                      <button onClick={() => handleDoneBooking(b.id)} className="bg-green-600 text-white px-2 py-1 rounded">Done</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}