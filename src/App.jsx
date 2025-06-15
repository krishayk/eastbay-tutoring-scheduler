import React, { useState, useEffect, useRef } from 'react';
import { courses } from './data/courses';
import { generateSchedule, assignTutorPersistent } from './utils/scheduler';
import AdminPanel from './components/AdminPanel';
import BookingForm from './components/BookingForm';
import AuthForm from './components/AuthForm';
import Settings from './components/Settings';
import { db, auth } from './utils/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { packages } from './data/packages';
import { format, isSameDay, addDays, differenceInCalendarDays } from 'date-fns';
import MyLessons from './components/MyLessons';
import { FaBars } from 'react-icons/fa';

const TUTOR_EMAILS = [
  'krishay.k.30@gmail.com',
  'omjoshi823@gmail.com',
  'kanneboinatejas@gmail.com'
];

const TUTOR_EMAIL_TO_NAME = {
  'krishay.k.30@gmail.com': 'Krishay',
  'omjoshi823@gmail.com': 'Om',
  'kanneboinatejas@gmail.com': 'Tejas'
};

function MyPackage({ userProfile, onChangePackage, onCancelPackage }) {
  const pkg = userProfile?.packageId ? packages.find(p => p.id === userProfile.packageId) : null;
  
  // Calculate next Sunday and days until then
  function getNextSundayInfo() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
    const nextSunday = addDays(today, daysUntilSunday);
    return {
      date: nextSunday,
      days: daysUntilSunday
    };
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg p-8 mt-10">
      <h2 className="text-2xl font-bold mb-4">My Package</h2>
      {!userProfile?.verified && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">Account Not Verified</h3>
          <div className="space-y-3 text-yellow-700">
            <p>Please send this week's package payment via Zelle to <span className="font-bold">9258758136</span> (The name may be listed under Krishay Kuchimanchi).</p>
            <p>Make payments every Sunday to avoid missing sessions.</p>
            <p><span className="font-bold">In the Zelle note, please include your child's name.</span></p>
            <p>After your first payment, you'll be verified within 24 hours.</p>
            <p>Questions? Text the number above.</p>
          </div>
        </div>
      )}
      {pkg ? (
        <>
          <div className="mb-4">
            <div className="font-semibold text-lg text-blue-900">{pkg.name}</div>
            <div className="text-gray-700 text-lg mt-1">${pkg.price}/week</div>
            <div className="text-sm text-gray-500 mt-2">{pkg.description}</div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Sessions per week: <span className="font-bold">{pkg.sessionsPerWeek}</span></span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Status: <span className={userProfile.verified ? 'text-green-600 font-bold' : 'text-yellow-600 font-bold'}>{userProfile.verified ? 'Verified' : 'Pending Verification'}</span></span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Next Payment Due: <span className="font-bold">{format(getNextSundayInfo().date, 'MMMM d')}</span> (<span className="font-bold">{getNextSundayInfo().days}</span> days)</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={onChangePackage} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">Change Package</button>
            <button onClick={onCancelPackage} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors">Cancel Package</button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-600 mb-4">No package selected.</div>
          <button onClick={onChangePackage} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors">
            Select a Package
          </button>
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
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'package');
  const [showChange, setShowChange] = useState(false);
  const [newPackageId, setNewPackageId] = useState('');
  const [calendarEvent, setCalendarEvent] = useState(null);
  const meetModalRef = useRef();
  const [isTutor, setIsTutor] = useState(false);
  const [oauthChecked, setOauthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Check if user is a tutor
  useEffect(() => {
    if (userProfile && TUTOR_EMAILS.includes(userProfile.email)) {
      setIsTutor(true);
    } else {
      setIsTutor(false);
    }
  }, [userProfile]);

  // Check OAuth2 session (for tutors)
  useEffect(() => {
    if (isTutor) {
      fetch('https://calendar-backend-tejy.onrender.com/api/check-auth', {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          console.log('OAuth check response:', data);
          setOauthChecked(data.authenticated);
        })
        .catch(() => setOauthChecked(false));
    }
  }, [isTutor]);

  // Manual refresh for debugging
  const handleCheckGoogleAuth = () => {
    fetch('https://calendar-backend-tejy.onrender.com/api/check-auth', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        alert('OAuth check: ' + JSON.stringify(data));
        setOauthChecked(data.authenticated);
      })
      .catch(() => setOauthChecked(false));
  };

  const handleBook = async (data) => {
    if (!userProfile || !userProfile.verified) return;
    try {
      // Get assigned tutor using persistent assignment
      const assignedTutor = await assignTutorPersistent({ day: data.day, time: data.time });
      if (assignedTutor === "No Available Tutor") {
        alert('No tutors are available at this time. Please try a different time slot.');
        return;
      }

      // Gather emails: parent, tutor, child (if present)
      const parentEmail = userProfile.email;
      let tutorEmail = '';
      if (assignedTutor === 'Krishay') tutorEmail = 'krishay.k.30@gmail.com';
      else if (assignedTutor === 'Om') tutorEmail = 'omjoshi823@gmail.com';
      else if (assignedTutor === 'Tejas') tutorEmail = 'kanneboinatejas@gmail.com';
      const childEmail = data.childEmail || '';
      const attendees = [parentEmail, tutorEmail];
      if (childEmail) attendees.push(childEmail);

      // Format start/end times (assume data.date is ISO string, data.time is e.g. '2:30 PM')
      const startDate = new Date(data.date);
      const [time, meridian] = data.time.split(' ');
      let [hour, minute] = time.split(':').map(Number);
      if (meridian === 'PM' && hour !== 12) hour += 12;
      if (meridian === 'AM' && hour === 12) hour = 0;
      startDate.setHours(hour, minute, 0, 0);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour session

      // Create Firestore booking (no Meet link)
      const newBooking = {
        ...data,
        tutor: assignedTutor,
        userId: userProfile.id,
        date: startDate.toISOString(),
        time: data.time,
        meetLink: '',
        eventLink: ''
      };
      await addDoc(collection(db, 'bookings'), newBooking);
      alert('Your lesson is booked! The tutor will generate a Meet link before the session.');
    } catch (err) {
      alert('Booking failed: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'bookings', id));
  };

  const handleAdminLogin = () => {
    if (password === '!KrishayTejasOm123') setAdmin(true);
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

  // Tutor UI: Only show My Lessons for tutors
  if (isTutor) {
    const tutorFirstName = TUTOR_EMAIL_TO_NAME[userProfile?.email];
    return (
      <div className="min-h-screen flex flex-col sm:flex-row bg-[#f4f8ff]">
        <button className="sm:hidden fixed top-4 left-4 z-30 bg-white rounded-full p-2 shadow" onClick={() => setSidebarOpen(true)}><FaBars size={24} /></button>
        {sidebarOpen && (
          <div className="sm:hidden fixed inset-0 z-20 bg-black bg-opacity-40" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={`sm:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-30 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex flex-col items-center mb-10 px-4 text-center">
            <img src="/logo.png" alt="East Bay Tutoring Logo" className="w-16 h-16 mb-2 rounded-full shadow-lg bg-white object-contain" />
            <span className="font-extrabold text-2xl text-blue-700 leading-tight tracking-tight drop-shadow-sm" style={{letterSpacing: '0.01em'}}>East Bay Tutoring<br />Scheduling</span>
          </div>
          <nav className="flex flex-col gap-4 w-full px-8">
            <button onClick={() => setActiveTab('lessons')} className={`text-left px-2 py-2 rounded ${activeTab === 'lessons' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Lessons</button>
            <button onClick={() => setActiveTab('admin')} className={`text-left px-2 py-2 rounded ${activeTab === 'admin' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Admin Only</button>
          </nav>
          <button onClick={handleLogout} className="mt-10 bg-gray-200 px-4 py-2 rounded">Logout</button>
        </aside>
        <aside className="hidden sm:flex w-80 bg-white shadow-lg flex-col items-center py-8 px-8">
          <div className="flex flex-col items-center mb-10 px-4 text-center">
            <img src="/logo.png" alt="East Bay Tutoring Logo" className="w-16 h-16 mb-2 rounded-full shadow-lg bg-white object-contain" />
            <span className="font-extrabold text-2xl text-blue-700 leading-tight tracking-tight drop-shadow-sm" style={{letterSpacing: '0.01em'}}>East Bay Tutoring<br />Scheduling</span>
          </div>
          <nav className="flex flex-col gap-4 w-full px-8">
            <button onClick={() => { setActiveTab('package'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'package' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Package</button>
            <button onClick={() => { setActiveTab('schedule'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'schedule' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Schedule A Lesson</button>
            <button onClick={() => { setActiveTab('lessons'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'lessons' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Lessons</button>
            <button onClick={() => { setActiveTab('settings'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Settings</button>
            <button onClick={() => setActiveTab('admin')} className={`text-left px-2 py-2 rounded ${activeTab === 'admin' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Admin Only</button>
          </nav>
          <button onClick={handleLogout} className="mt-10 bg-gray-200 px-4 py-2 rounded">Logout</button>
        </aside>
        <main className="flex-1 flex flex-col px-2 sm:px-0">
          {activeTab === 'lessons' && (
            <MyLessons tutorMode={true} tutorName={tutorFirstName} tutorEmail={userProfile?.email} oauthChecked={oauthChecked} />
          )}
          {activeTab === 'admin' && (
            <AdminPanel bookings={bookings} onDelete={handleDelete} />
          )}
        </main>
      </div>
    );
  }

  // Regular UI for non-tutors
  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-[#f4f8ff]">
      <button className="sm:hidden fixed top-4 left-4 z-30 bg-white rounded-full p-2 shadow" onClick={() => setSidebarOpen(true)}><FaBars size={24} /></button>
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-20 bg-black bg-opacity-40" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`sm:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-30 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col items-center mb-10 px-4 text-center">
          <img src="/logo.png" alt="East Bay Tutoring Logo" className="w-16 h-16 mb-2 rounded-full shadow-lg bg-white object-contain" />
          <span className="font-extrabold text-2xl text-blue-700 leading-tight tracking-tight drop-shadow-sm" style={{letterSpacing: '0.01em'}}>East Bay Tutoring<br />Scheduling</span>
        </div>
        <nav className="flex flex-col gap-4 w-full px-8">
          <button onClick={() => { setActiveTab('package'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'package' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Package</button>
          <button onClick={() => { setActiveTab('schedule'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'schedule' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Schedule A Lesson</button>
          <button onClick={() => { setActiveTab('lessons'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'lessons' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Lessons</button>
          <button onClick={() => { setActiveTab('settings'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Settings</button>
          <button onClick={() => setActiveTab('admin')} className={`text-left px-2 py-2 rounded ${activeTab === 'admin' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Admin Only</button>
        </nav>
        <button onClick={handleLogout} className="mt-10 bg-gray-200 px-4 py-2 rounded">Logout</button>
      </aside>
      <aside className="hidden sm:flex w-80 bg-white shadow-lg flex-col items-center py-8 px-8">
        <div className="flex flex-col items-center mb-10 px-4 text-center">
          <img src="/logo.png" alt="East Bay Tutoring Logo" className="w-16 h-16 mb-2 rounded-full shadow-lg bg-white object-contain" />
          <span className="font-extrabold text-2xl text-blue-700 leading-tight tracking-tight drop-shadow-sm" style={{letterSpacing: '0.01em'}}>East Bay Tutoring<br />Scheduling</span>
        </div>
        <nav className="flex flex-col gap-4 w-full px-8">
          <button onClick={() => { setActiveTab('package'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'package' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Package</button>
          <button onClick={() => { setActiveTab('schedule'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'schedule' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Schedule A Lesson</button>
          <button onClick={() => { setActiveTab('lessons'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'lessons' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>My Lessons</button>
          <button onClick={() => { setActiveTab('settings'); setAdmin(false); }} className={`text-left px-2 py-2 rounded ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Settings</button>
          <button onClick={() => setActiveTab('admin')} className={`text-left px-2 py-2 rounded ${activeTab === 'admin' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-blue-50'}`}>Admin Only</button>
        </nav>
        <button onClick={handleLogout} className="mt-10 bg-gray-200 px-4 py-2 rounded">Logout</button>
      </aside>
      <main className="flex-1 flex flex-col px-2 sm:px-0">
        <header className="flex justify-end items-center p-6 bg-transparent">
          {/* Removed search and profile picture */}
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
            <BookingForm bookings={bookings} onBook={handleBook} userProfile={userProfile} onGoToSettings={() => setActiveTab('settings')} />
          )}
          {activeTab === 'lessons' && (
            <MyLessons />
          )}
          {activeTab === 'settings' && (
            <Settings />
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