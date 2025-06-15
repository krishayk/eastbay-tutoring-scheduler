// /src/components/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, updateDoc, doc, getDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { packages } from '../data/packages';
import { format } from 'date-fns';

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
      <h2 className="text-3xl font-extrabold mb-8 text-center text-blue-800 tracking-tight">Admin Panel</h2>
      <div className="mb-10 bg-blue-50 rounded-xl shadow p-6 border border-blue-200">
        <h3 className="text-2xl font-semibold mb-4 text-blue-700 border-b border-blue-200 pb-2">Users</h3>
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-blue-100">
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Parent Name</th>
                <th className="p-3 font-semibold">Parent Phone</th>
                <th className="p-3 font-semibold">Child Name</th>
                <th className="p-3 font-semibold">Package</th>
                <th className="p-3 font-semibold">Verified</th>
                <th className="p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const pkg = packages.find(p => p.id === u.packageId);
                return (
                  <tr key={u.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition`}>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.parentName || '-'}</td>
                    <td className="p-3">{u.parentPhone || '-'}</td>
                    <td className="p-3">{userChildren[u.id]?.join(', ') || '-'}</td>
                    <td className="p-3">{pkg ? pkg.name : '-'}</td>
                    <td className="p-3">
                      {u.verified ? (
                        <span className="inline-block px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-700">Verified</span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs font-bold rounded bg-yellow-100 text-yellow-700">Pending</span>
                      )}
                    </td>
                    <td className="p-3 flex flex-wrap gap-2">
                      {u.verified ? (
                        <button onClick={() => handleVerify(u.id, false)} className="bg-yellow-500 text-white px-3 py-1 rounded shadow hover:bg-yellow-600 transition">Unverify</button>
                      ) : (
                        <button onClick={() => handleVerify(u.id, true)} className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700 transition">Verify</button>
                      )}
                      <button onClick={() => handleDeleteUser(u.id, u.email)} className="bg-red-600 text-white px-3 py-1 rounded shadow hover:bg-red-700 transition">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="h-8" />
      <div className="bg-blue-50 rounded-xl shadow p-6 border border-blue-200">
        <h3 className="text-2xl font-semibold mb-4 text-blue-700 border-b border-blue-200 pb-2">Bookings</h3>
        <div className="overflow-x-auto rounded-lg">
          {bookings.length === 0 ? (
            <p className="text-center text-gray-600">No sessions booked yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-blue-100">
                  <th className="p-3 font-semibold">Child</th>
                  <th className="p-3 font-semibold">Grade</th>
                  <th className="p-3 font-semibold">Course</th>
                  <th className="p-3 font-semibold">Day</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Time</th>
                  <th className="p-3 font-semibold">Tutor</th>
                  <th className="p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings
                  .slice()
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((b, i) => (
                    <tr key={b.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition`}>
                      {editingBooking === b.id ? (
                        <>
                          <td className="p-3"><input value={editBookingData.child} onChange={e => setEditBookingData({ ...editBookingData, child: e.target.value })} className="border rounded p-1 w-full" /></td>
                          <td className="p-3"><input value={editBookingData.grade} onChange={e => setEditBookingData({ ...editBookingData, grade: e.target.value })} className="border rounded p-1 w-full" /></td>
                          <td className="p-3"><input value={editBookingData.course} onChange={e => setEditBookingData({ ...editBookingData, course: e.target.value })} className="border rounded p-1 w-full" /></td>
                          <td className="p-3"><input value={editBookingData.day} onChange={e => setEditBookingData({ ...editBookingData, day: e.target.value })} className="border rounded p-1 w-full" /></td>
                          <td className="p-3">{b.date ? format(new Date(b.date), 'MMMM d') : ''}</td>
                          <td className="p-3"><input value={editBookingData.time} onChange={e => setEditBookingData({ ...editBookingData, time: e.target.value })} className="border rounded p-1 w-full" /></td>
                          <td className="p-3"><input value={editBookingData.tutor} onChange={e => setEditBookingData({ ...editBookingData, tutor: e.target.value })} className="border rounded p-1 w-full" /></td>
                          <td className="p-3 flex flex-wrap gap-2">
                            <button onClick={() => handleSaveBooking(b.id)} className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700 transition">Save</button>
                            <button onClick={() => setEditingBooking(null)} className="bg-gray-300 text-gray-800 px-3 py-1 rounded shadow hover:bg-gray-400 transition">Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3">{b.child}</td>
                          <td className="p-3">{b.grade}</td>
                          <td className="p-3">{b.course}</td>
                          <td className="p-3">{b.day}</td>
                          <td className="p-3">{b.date ? format(new Date(b.date), 'MMMM d') : ''}</td>
                          <td className="p-3">{b.time}</td>
                          <td className="p-3">{b.tutor}</td>
                          <td className="p-3 flex flex-wrap gap-2">
                            <button onClick={() => handleEditBooking(b)} className="bg-blue-500 text-white px-3 py-1 rounded shadow hover:bg-blue-600 transition">Edit</button>
                            <button onClick={() => handleDoneBooking(b.id)} className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700 transition">Done</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}