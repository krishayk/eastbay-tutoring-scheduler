// /src/components/AdminPanel.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../utils/firebase';
import { collection, onSnapshot, updateDoc, doc, getDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { packages } from '../data/packages';
import { format } from 'date-fns';

const coursesList = [
  "Math", "SAT", "College Counseling", "English", "Science", "History", "World Language", "Computer Science", "Other"
];
const daysList = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timesList = [
  "8:30 AM", "9:30 AM", "10:30 AM", "11:30 AM", "12:30 PM", "1:30 PM", "2:30 PM", "3:30 PM", "4:30 PM", "5:30 PM"
];
const tutors = ["Krishay", "Om", "Tejas"];

const TUTOR_EMAILS = [
  'krishay.k.30@gmail.com',
  'omjoshi823@gmail.com',
  'kanneboinatejas@gmail.com'
];

export default function AdminPanel({ bookings, onDelete, onGoToSettings }) {
  const [users, setUsers] = useState([]);
  const [userChildren, setUserChildren] = useState({});
  const [editingBooking, setEditingBooking] = useState(null);
  const [editBookingData, setEditBookingData] = useState({});
  const [substitutingTutor, setSubstitutingTutor] = useState(null);
  const [newTutor, setNewTutor] = useState('');
  const [editLocked, setEditLocked] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null);

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
        childrenByUser[data.userId].push({ name: data.name, grade: data.grade, email: data.email });
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
    setEditLocked(false);
  };

  const handleSaveBooking = async (bookingId) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), editBookingData);
      setEditingBooking(null);
      setEditLocked(true);
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

  const handleSubstituteTutor = async (bookingId, currentTutor) => {
    setSubstitutingTutor(bookingId);
    setNewTutor(currentTutor);
  };

  const handleSaveSubstitution = async (bookingId) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { tutor: newTutor });
      setSubstitutingTutor(null);
    } catch (error) {
      alert('Failed to update tutor.');
    }
  };

  // Helper to get the next date for a given day
  function getNextDateForDay(day) {
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    const todayIdx = today.getDay();
    const targetIdx = daysOfWeek.indexOf(day);
    let diff = targetIdx - todayIdx;
    if (diff <= 0) diff += 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + diff);
    return nextDate;
  }

  // Helper to get end time for a slot (1 hour after start)
  function getEndTime(startTime) {
    const [time, meridian] = startTime.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (meridian === 'PM' && hour !== 12) hour += 12;
    if (meridian === 'AM' && hour === 12) hour = 0;
    const startDate = new Date(2000, 0, 1, hour, minute);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    let endHour = endDate.getHours();
    let endMinute = endDate.getMinutes();
    let endMeridian = endHour >= 12 ? 'PM' : 'AM';
    endHour = ((endHour + 11) % 12) + 1;
    endMinute = endMinute.toString().padStart(2, '0');
    return `${endHour}:${endMinute} ${endMeridian}`;
  }

  // Compute statistics for each tutor
  const tutorStats = tutors.map(tutor => {
    const now = new Date();
    const completed = bookings.filter(b => b.tutor === tutor && new Date(b.date) < now).length;
    const upcoming = bookings.filter(b => b.tutor === tutor && new Date(b.date) >= now).length;
    return { tutor, completed, upcoming };
  });

  const handleToggleAdmin = async (userId, isAdmin) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isAdmin: !isAdmin });
    } catch (error) {
      alert('Failed to update admin status.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Admin Panel</h2>
        </div>

        {editingBooking === null && (
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">Tutor Statistics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {tutorStats.map(stat => (
                  <div key={stat.tutor} className="bg-blue-50 rounded-lg p-4 flex flex-col items-center border border-blue-200">
                    <div className="text-lg font-bold text-blue-800 mb-2">{stat.tutor}</div>
                    <div className="text-green-700 font-semibold">Sessions Completed: {stat.completed}</div>
                    <div className="text-yellow-700 font-semibold">Sessions Upcoming: {stat.upcoming}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Users Section */}
            <div className="mb-10 bg-blue-50 rounded-xl shadow p-6 border border-blue-200">
              <h3 className="text-2xl font-semibold mb-4 text-blue-700 border-b border-blue-200 pb-2">Client Users</h3>
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
                    {users.filter(u => !u.isAdmin && !TUTOR_EMAILS.includes(u.email)).map((u, i) => {
                      const pkg = packages.find(p => p.id === u.packageId);
                      return (
                        <tr key={u.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition`}>
                          <td className="p-3">{u.email}</td>
                          <td className="p-3">{u.parentName || '-'}</td>
                          <td className="p-3">{u.parentPhone || '-'}</td>
                          <td className="p-3">{
                            userChildren[u.id]?.length
                              ? userChildren[u.id].map((child, idx) => (
                                  <div key={child.name + child.grade + child.email}>
                                    {child.name}
                                    {child.grade && <span className="text-gray-500"> (Grade {child.grade})</span>}
                                    {child.email && <span className="text-gray-400 text-xs ml-1">[{child.email}]</span>}
                                    {idx !== userChildren[u.id].length - 1 && <span>, </span>}
                                  </div>
                                ))
                              : '-'}</td>
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
                            <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)} className="bg-purple-600 text-white px-3 py-1 rounded shadow hover:bg-purple-700 transition">Make Admin</button>
                            <button onClick={() => handleDeleteUser(u.id, u.email)} className="bg-red-600 text-white px-3 py-1 rounded shadow hover:bg-red-700 transition">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Admin Users Section */}
            <div className="mb-10 bg-blue-50 rounded-xl shadow p-6 border border-blue-200">
              <h3 className="text-2xl font-semibold mb-4 text-blue-700 border-b border-blue-200 pb-2">Admin Users</h3>
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
                    {users.filter(u => u.isAdmin || TUTOR_EMAILS.includes(u.email)).map((u, i) => {
                      const pkg = packages.find(p => p.id === u.packageId);
                      return (
                        <tr key={u.id} className={`border-t ${i % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-blue-100 transition`}>
                          <td className="p-3">{u.email}</td>
                          <td className="p-3">{u.parentName || '-'}</td>
                          <td className="p-3">{u.parentPhone || '-'}</td>
                          <td className="p-3">{
                            userChildren[u.id]?.length
                              ? userChildren[u.id].map((child, idx) => (
                                  <div key={child.name + child.grade + child.email}>
                                    {child.name}
                                    {child.grade && <span className="text-gray-500"> (Grade {child.grade})</span>}
                                    {child.email && <span className="text-gray-400 text-xs ml-1">[{child.email}]</span>}
                                    {idx !== userChildren[u.id].length - 1 && <span>, </span>}
                                  </div>
                                ))
                              : '-'}</td>
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
                            {!TUTOR_EMAILS.includes(u.email) && (
                              <>
                                <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)} className="bg-blue-600 text-white px-3 py-1 rounded shadow hover:bg-blue-700 transition">Make Client</button>
                              </>
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
                                <td className="p-3">
                                  {editLocked ? (
                                    <span>{editBookingData.child} <button className="ml-2 text-blue-600 underline" onClick={() => setEditLocked(false)}>Edit</button></span>
                                  ) : (
                                    <input value={editBookingData.child} onChange={e => setEditBookingData({ ...editBookingData, child: e.target.value })} className="border rounded p-1 w-full" />
                                  )}
                                </td>
                                <td className="p-3">
                                  {editLocked ? (
                                    <span>{editBookingData.grade} <button className="ml-2 text-blue-600 underline" onClick={() => setEditLocked(false)}>Edit</button></span>
                                  ) : (
                                    <input value={editBookingData.grade} onChange={e => setEditBookingData({ ...editBookingData, grade: e.target.value })} className="border rounded p-1 w-full" />
                                  )}
                                </td>
                                <td className="p-3">
                                  {editLocked ? (
                                    <span>{editBookingData.course} <button className="ml-2 text-blue-600 underline" onClick={() => setEditLocked(false)}>Edit</button></span>
                                  ) : (
                                    <select value={editBookingData.course} onChange={e => setEditBookingData({ ...editBookingData, course: e.target.value })} className="border rounded p-1 w-full">
                                      {coursesList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                  )}
                                </td>
                                <td className="p-3">
                                  <select value={editBookingData.day} onChange={e => {
                                    const newDay = e.target.value;
                                    const newDate = getNextDateForDay(newDay);
                                    setEditBookingData({ ...editBookingData, day: newDay, date: newDate.toISOString() });
                                  }} className="border rounded p-1 w-full">
                                    {daysList.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </td>
                                <td className="p-3">{editBookingData.date ? format(new Date(editBookingData.date), 'MMMM d') : ''}</td>
                                <td className="p-3">
                                  <select value={editBookingData.time} onChange={e => setEditBookingData({ ...editBookingData, time: e.target.value })} className="border rounded p-1 w-full">
                                    {timesList.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="p-3">
                                  <select value={editBookingData.tutor} onChange={e => setEditBookingData({ ...editBookingData, tutor: e.target.value })} className="border rounded p-1 w-full">
                                    {tutors.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </td>
                                <td className="p-3 flex flex-wrap gap-2">
                                  {editLocked ? (
                                    <button onClick={() => setEditLocked(false)} className="bg-blue-500 text-white px-3 py-1 rounded shadow hover:bg-blue-600 transition">Unlock</button>
                                  ) : (
                                    <>
                                      <button onClick={() => handleSaveBooking(b.id)} className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700 transition">Save</button>
                                      <button onClick={() => { setEditingBooking(null); setEditLocked(true); }} className="bg-gray-300 text-gray-800 px-3 py-1 rounded shadow hover:bg-gray-400 transition">Cancel</button>
                                    </>
                                  )}
                                </td>
                              </>
                            ) : substitutingTutor === b.id ? (
                              <>
                                <td className="p-3">{b.child}</td>
                                <td className="p-3">{b.grade}</td>
                                <td className="p-3">{b.course}</td>
                                <td className="p-3">{b.day}</td>
                                <td className="p-3">{b.date ? format(new Date(b.date), 'MMMM d') : ''}</td>
                                <td className="p-3">{b.time} - {getEndTime(b.time)}</td>
                                <td className="p-3">
                                  <select
                                    value={newTutor}
                                    onChange={(e) => setNewTutor(e.target.value)}
                                    className="border rounded p-1 w-full"
                                  >
                                    {tutors.map(tutor => (
                                      <option key={tutor} value={tutor}>{tutor}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-3 flex flex-wrap gap-2">
                                  <button onClick={() => handleSaveSubstitution(b.id)} className="bg-green-600 text-white px-3 py-1 rounded shadow hover:bg-green-700 transition">Save</button>
                                  <button onClick={() => setSubstitutingTutor(null)} className="bg-gray-300 text-gray-800 px-3 py-1 rounded shadow hover:bg-gray-400 transition">Cancel</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="p-3">{b.child}</td>
                                <td className="p-3">{b.grade}</td>
                                <td className="p-3">{b.course}</td>
                                <td className="p-3">{b.day}</td>
                                <td className="p-3">{b.date ? format(new Date(b.date), 'MMMM d') : ''}</td>
                                <td className="p-3">{b.time} - {getEndTime(b.time)}</td>
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
        )}
      </div>
      {showConfirmModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Confirm Change</h3>
            <p>Are you sure you want to change the child or grade? This may affect reporting and tracking.</p>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowConfirmModal(false); setPendingEdit(null); }} className="bg-gray-300 text-gray-800 px-4 py-2 rounded">Cancel</button>
              <button onClick={() => { setShowConfirmModal(false); handleSaveBooking(editingBooking); setPendingEdit(null); }} className="bg-blue-600 text-white px-4 py-2 rounded">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}