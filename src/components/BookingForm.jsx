import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { courses } from '../data/courses';
import { format } from 'date-fns';

export default function BookingForm({ bookings, onBook }) {
  const [child, setChild] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');

  const allTimes = generateTimes();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!child || !grade || !selectedCourse || !selectedDate || !selectedTime) return;
    const day = format(selectedDate, 'EEEE'); // e.g. 'Monday'
    const time = selectedTime;
    onBook({ child, grade, course: selectedCourse, day, time, duration });
    setChild(''); setGrade(''); setSelectedCourse(''); setSelectedDate(null); setSelectedTime('');
  };

  return (
    <div className="grid md:grid-cols-2 bg-white shadow-lg rounded-xl overflow-hidden max-w-5xl mx-auto mt-10">
      {/* LEFT PANEL */}
      <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-8">
        <h2 className="text-3xl font-bold text-purple-800 mb-6">Book a Tutoring Session</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Child's Name" value={child}
            onChange={(e) => setChild(e.target.value)}
            className="w-full p-3 rounded-md border border-purple-300 bg-white" />

          <input type="text" placeholder="Grade Level" value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="w-full p-3 rounded-md border border-purple-300 bg-white" />

          <select value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full p-3 rounded-md border border-purple-300 bg-white">
            <option value="">Select a Course</option>
            {courses.map(c => <option key={c}>{c}</option>)}
          </select>

          <select value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full p-3 rounded-md border border-purple-300 bg-white">
            <option value="60">1 Hour</option>
            <option value="90">90 Minutes</option>
          </select>

          <button type="submit"
            className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg">
            Confirm Booking
          </button>
        </form>
      </div>

      {/* RIGHT PANEL */}
      <div className="p-8 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a Date & Time</h3>

        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          inline
          calendarClassName="!rounded-xl !border-gray-300"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Available Times</label>
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full p-3 rounded-md border border-purple-300 bg-white"
          >
            <option value="">Select a Time</option>
            {allTimes.map(t => (
              <option key={t} value={t} disabled={isBooked(selectedDate, t)}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-500">Timezone: Pacific Time (PST/PDT)</p>
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

function isBooked(date, time) {
  // For now: always return false (mock). You can add your booking check logic here.
  return false;
}