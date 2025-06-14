// /src/components/AdminPanel.jsx
import React from 'react';

export default function AdminPanel({ bookings, setBookings }) {
  const handleDelete = (index) => {
    const copy = [...bookings];
    copy.splice(index, 1);
    setBookings(copy);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Admin Panel</h2>
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
            {bookings.map((b, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{b.child}</td>
                <td className="p-2">{b.grade}</td>
                <td className="p-2">{b.course}</td>
                <td className="p-2">{b.day}</td>
                <td className="p-2">{b.time}</td>
                <td className="p-2">{b.duration} mins</td>
                <td className="p-2">{b.tutor}</td>
                <td className="p-2">
                  <button onClick={() => handleDelete(i)} className="bg-red-500 text-white px-2 py-1 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}