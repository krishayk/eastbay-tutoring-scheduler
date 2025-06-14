import React, { useState } from 'react';
import { courses } from './data/courses';
import { generateSchedule, assignTutor } from './utils/scheduler';
import AdminPanel from './components/AdminPanel';
import BookingForm from './components/BookingForm';

export default function App() {
  const [bookings, setBookings] = useState([]);
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState('');

  const handleBook = (data) => {
    const assignedTutor = assignTutor(data, bookings);
    const newBooking = { ...data, tutor: assignedTutor };
    setBookings([...bookings, newBooking]);
  };

  const handleAdminLogin = () => {
    if (password === 'Admin123') setAdmin(true);
  };

  return (
    <div className="p-4 font-sans bg-gradient-to-br from-pink-100 to-blue-100 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-4">East Bay Tutoring Scheduler</h1>
      {!admin ? (
        <>
          <BookingForm bookings={bookings} onBook={handleBook} />
          <div className="mt-6 text-center">
            <input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-2 border rounded mr-2"
            />
            <button onClick={handleAdminLogin} className="bg-blue-500 text-white px-4 py-2 rounded">
              Admin Login
            </button>
          </div>
        </>
      ) : (
        <AdminPanel bookings={bookings} setBookings={setBookings} />
      )}
    </div>
  );
}