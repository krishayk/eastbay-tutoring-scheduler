import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { courses } from '../data/courses';
import { format, startOfWeek, endOfWeek, isSameDay, addWeeks, addDays, isBefore, isAfter, addHours } from 'date-fns';
import { packages } from '../data/packages';

export default function BookingForm({ bookings, onBook, userProfile }) {
  const [child, setChild] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [recurring, setRecurring] = useState(false);

  const allTimes = generateTimes();

  // Find user's package info
  const userPackage = userProfile && packages.find(p => p.id === userProfile.packageId);
  const userBookingsThisWeek = userProfile && selectedDate
    ? bookings.filter(b => b.userId === userProfile.id && isSameWeek(new Date(b.date), selectedDate)).length
    : 0;
  const canBook = userProfile && userProfile.verified && userPackage && userBookingsThisWeek < userPackage.sessionsPerWeek;

  // Only allow dates within the current week and 24+ hours in advance
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

  // Only show available times for the selected date
  const bookedTimes = selectedDate
    ? bookings.filter(b => isSameDay(new Date(b.date), selectedDate)).map(b => b.time)
    : [];

  const availableTimes = allTimes.filter(t => {
    // Exclude times already booked
    if (bookedTimes.includes(t)) return false;
    // Exclude times less than 24 hours from now
    if (selectedDate) {
      const [hour, minute, meridian] = t.match(/(\d+):(\d+) (AM|PM)/).slice(1);
      let h = parseInt(hour, 10);
      if (meridian === 'PM' && h !== 12) h += 12;
      if (meridian === 'AM' && h === 12) h = 0;
      const slotDate = new Date(selectedDate);
      slotDate.setHours(h, parseInt(minute, 10), 0, 0);
      if (isBefore(slotDate, addHours(now, 24))) return false;
    }
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!child || !grade || !selectedCourse || !selectedDate || !selectedTime) return;
    const day = format(selectedDate, 'EEEE');
    const time = selectedTime;
    // Recurring booking logic
    if (recurring) {
      for (let i = 0; i < 4; i++) {
        const recurDate = addWeeks(selectedDate, i);
        onBook({ child, grade, course: selectedCourse, day: format(recurDate, 'EEEE'), time, duration, date: recurDate.toISOString() });
      }
    } else {
      onBook({ child, grade, course: selectedCourse, day, time, duration, date: selectedDate.toISOString() });
    }
    setChild(''); setGrade(''); setSelectedCourse(''); setSelectedDate(null); setSelectedTime(''); setRecurring(false);
  };

  return (
    <div className="flex justify-center items-start gap-8 w-full max-w-4xl mx-auto mt-10">
      {/* Calendar Column */}
      <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[320px] flex flex-col items-center">
        <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <span className="text-yellow-500">📅</span> Book your lesson
        </h2>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          inline
          calendarClassName="!rounded-xl !border-gray-300"
          minDate={weekStart}
          maxDate={weekEnd}
          filterDate={date => isAfter(date, addHours(now, 24)) && isBefore(date, addDays(weekEnd, 1))}
        />
      </div>

      {/* Time Selection & Form Column */}
      <div className="flex flex-col gap-6 min-w-[260px]">
        {!userProfile?.verified && (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded mb-4 text-center font-semibold">
            Your account is not verified. Please wait for admin approval after payment.
          </div>
        )}
        {userProfile?.verified && userPackage && userBookingsThisWeek >= userPackage.sessionsPerWeek && (
          <div className="bg-red-100 text-red-800 p-4 rounded mb-4 text-center font-semibold">
            You have reached your weekly booking limit for your package.
          </div>
        )}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Schedule a lesson</h3>
          <input type="text" placeholder="Child's Name" value={child}
            onChange={(e) => setChild(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white" />

          <input type="text" placeholder="Grade Level" value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white" />

          <select value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white">
            <option value="">Select a Course</option>
            {courses.map(c => <option key={c}>{c}</option>)}
          </select>

          <select value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white">
            <option value="60">1 Hour</option>
            <option value="90">90 Minutes</option>
          </select>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pick a time</label>
            <div className="flex flex-col gap-2">
              {availableTimes.length === 0 && <div className="text-gray-500">No available times for this date.</div>}
              {availableTimes.map(t => (
                <button
                  type="button"
                  key={t}
                  className={`rounded-full px-4 py-2 text-left font-semibold border transition-all ${selectedTime === t ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                  onClick={() => setSelectedTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            Make this a recurring weekly lesson (next 4 weeks)
          </label>

          <button type="submit"
            className="w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold py-3 rounded-lg transition-all"
            disabled={!canBook || !selectedTime || !selectedDate || availableTimes.length === 0}
          >
            Confirm Booking
          </button>
        </form>
        <p className="text-sm text-gray-500 text-center">Timezone: Pacific Time (PST/PDT)</p>
      </div>
    </div>
  );
}

function generateTimes() {
  const slots = [];
  const add = (h, m) => {
    const meridian = h >= 12 ? 'PM' : 'AM';
    const hour = ((h + 11) % 12) + 1;
    const minute = m.toString().padStart(2, '0');
    slots.push(`${hour}:${minute} ${meridian}`);
  };

  for (let h = 8; h <= 12; h++) add(h, 30);
  for (let h = 13; h <= 19; h++) add(h, 30);

  return slots;
}

function isSameWeek(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const startOfWeek = d => {
    const day = d.getDay();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  };
  return startOfWeek(d1).getTime() === startOfWeek(d2).getTime();
}