import React, { useState, useEffect } from 'react';
import { courses } from './data/courses';
import { generateSchedule, assignTutor } from './utils/scheduler';
import AdminPanel from './components/AdminPanel';
import BookingForm from './components/BookingForm';
import AuthForm from './components/AuthForm';
import { db, auth } from './utils/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { packages } from './data/packages';

function MyPackage({ userProfile, onChangePackage, onCancelPackage }) {
  const pkg = userProfile && packages.find(p => p.id === userProfile.packageId);
  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-8 mt-10">
      <h2 className="text-2xl font-bold mb-4">My Package</h2>
      {pkg ? (
        <>
          <div className="mb-4">
            <div className="font-semibold">{pkg.name}</div>
            <div className="text-gray-700">${pkg.price}/week</div>
            <div className="text-sm text-gray-500 mt-2">{pkg.description}</div>
            <div className="mt-2">Sessions per week: <span className="font-bold">{pkg.sessionsPerWeek}</span></div>
            <div className="mt-2">Status: <span className={userProfile.verified ? 'text-green-600 font-bold' : 'text-yellow-600 font-bold'}>{userProfile.verified ? 'Verified' : 'Pending Verification'}</span></div>
          </div>
          <div className="flex gap-4">
            <button onClick={onChangePackage} className="bg-blue-600 text-white px-4 py-2 rounded">Change Package</button>
            <button onClick={onCancelPackage} className="bg-red-500 text-white px-4 py-2 rounded">Cancel Package</button>
          </div>
        </>
      ) : (
        <div className="text-gray-600">No package selected.</div>
      )}
    </div>
  );
}

function MyLessons({ bookings, userProfile, onCancel }) {
  const myLessons = bookings.filter(b => b.userId === userProfile?.id);
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8 mt-10">
      <h2 className="text-2xl font-bold mb-4">My Lessons</h2>
      {myLessons.length === 0 ? (
        <div className="text-gray-600">No lessons booked yet.</div>
      ) : (
        <div className="grid gap-4">
          {myLessons.map((b) => {
            const lessonDate = b.date ? new Date(b.date) : null;
            const isFuture = lessonDate && lessonDate >= new Date();
            return (
              <div key={b.id} className="rounded-xl border border-gray-200 shadow p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 bg-blue-50">
                <div>
                  <div className="font-semibold text-blue-900">{b.course}</div>
                  <div className="text-gray-700 text-sm">{lessonDate ? lessonDate.toLocaleDateString() : '-'} at {b.time}</div>
                  <div className="text-gray-500 text-xs">Tutor: {b.tutor}</div>
                </div>
                {isFuture && (
                  <button onClick={() => onCancel(b.id)} className="bg-red-500 text-white px-4 py-2 rounded self-end md:self-auto">Cancel</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [bookings, setBookings] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('package');
  const [showChange, setShowChange] = useState(false);
  const [newPackageId, setNewPackageId] = useState('');

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        setUserProfile(userDoc.exists() ? { id: u.uid, ...userDoc.data() } : null);
      } else {
        setUserProfile(null);
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firestore sync
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleBook = async (data) => {
    if (!userProfile || !userProfile.verified) return;
    const assignedTutor = assignTutor(data, bookings);
    const newBooking = { ...data, tutor: assignedTutor, userId: userProfile.id };
    await addDoc(collection(db, 'bookings'), newBooking);
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'bookings', id));
  };

  const handleAdminLogin = () => {
    if (password === 'Admin123') setAdmin(true);
  };

  const handleLogout = () => {
    signOut(auth);
    setAdmin(false);
  };

  const handleChangePackage = () => {
    setShowChange(true);
    setNewPackageId(userProfile.packageId);
  };

  const handleCancelPackage = async () => {
    if (userProfile) {
      await updateDoc(doc(db, 'users', userProfile.id), { packageId: '', verified: false });
    }
  };

  const handleSavePackage = async () => {
    if (userProfile && newPackageId) {
      await updateDoc(doc(db, 'users', userProfile.id), { packageId: newPackageId, verified: false });
      setShowChange(false);
    }
  };

  if (loading) return <div className="text-center mt-20">Loading...</div>;
  if (!user) return <AuthForm onAuth={setUser} />;

  return (
    <div className="min-h-screen flex bg-[#f4f8ff]">
      {/* Sidebar */}
      <aside className="w-80 bg-white shadow-lg flex flex-col items-center py-8">
        <div className="flex items-center mb-10 px-4 text-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2">
            <span className="text-white font-bold text-lg">O</span>
          </div>
          <span className="font-bold text-lg text-blue-700 leading-tight">East Bay Tutoring<br />Scheduling</span>
        </div>
        <nav className="flex flex-col gap-4 w-full px-8">
          <button onClick={() => { setActiveTab('package'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'package' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Package</button>
          <button onClick={() => { setActiveTab('schedule'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'schedule' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Schedule A Lesson</button>
          <button onClick={() => { setActiveTab('lessons'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'lessons' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Lessons</button>
          <button onClick={() => setActiveTab('admin')} className={`text-left px-2 py-2 rounded ${activeTab === 'admin' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Admin Only</button>
        </nav>
        <button onClick={handleLogout} className="mt-10 bg-gray-200 px-4 py-2 rounded">Logout</button>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="flex justify-end items-center p-6 bg-transparent">
          <input
            type="text"
            placeholder="Search"
            className="border rounded px-3 py-1 mr-4"
          />
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600">U</span>
          </div>
        </header>
        <div className="flex-1 flex flex-col justify-center">
          {activeTab === 'package' && !showChange && (
            <MyPackage userProfile={userProfile} onChangePackage={handleChangePackage} onCancelPackage={handleCancelPackage} />
          )}
          {activeTab === 'package' && showChange && (
            <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-8 mt-10">
              <h2 className="text-2xl font-bold mb-4">Change Package</h2>
              <select value={newPackageId} onChange={e => setNewPackageId(e.target.value)} className="w-full p-3 rounded-md border border-blue-200 bg-white mb-4">
                <option value="">Select a Package</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} - ${pkg.price}/week</option>
                ))}
              </select>
              <div className="flex gap-4">
                <button onClick={handleSavePackage} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
                <button onClick={() => setShowChange(false)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded">Cancel</button>
              </div>
            </div>
          )}
          {activeTab === 'schedule' && (
            <BookingForm bookings={bookings} onBook={handleBook} userProfile={userProfile} />
          )}
          {activeTab === 'lessons' && (
            <MyLessons bookings={bookings} userProfile={userProfile} onCancel={handleDelete} />
          )}
          {activeTab === 'admin' && !admin && (
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 mt-10 text-center">
              <h2 className="text-2xl font-bold mb-4">Admin Login</h2>
              <input
                type="password"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border rounded mr-2"
              />
              <button onClick={handleAdminLogin} className="bg-blue-500 text-white px-4 py-2 rounded">
                Enter
              </button>
            </div>
          )}
          {activeTab === 'admin' && admin && (
            <AdminPanel bookings={bookings} onDelete={handleDelete} />
          )}
        </div>
      </main>
    </div>
  );
}