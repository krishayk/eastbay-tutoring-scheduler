import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isToday } from 'date-fns';
import { db } from '../utils/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../utils/AuthContext';
import { assignTutorPersistent } from '../utils/scheduler';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '8:30 AM', '9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM',
  '1:30 PM', '2:30 PM', '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM', '7:30 PM'
];

const QUOTES = [
  "The best way to predict the future is to create it.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "Opportunities don't happen, you create them.",
  "Your time is limited, so don't waste it living someone else's life.",
  "Dream big and dare to fail."
];

function getWeekRange(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
}

// Call this after saving unavailableSlots
async function reassignConflictingLessons(currentUser, unavailableSlots) {
  if (!currentUser) return;
  try {
    const now = new Date();
    const bookingsRef = collection(db, 'bookings');
    let tutorName = "UNKNOWN";
    if (currentUser.email === "krishay.k.30@gmail.com") tutorName = "Krishay";
    else if (currentUser.email === "omjoshi823@gmail.com") tutorName = "Om";
    else if (currentUser.email === "kanneboinatejas@gmail.com") tutorName = "Tejas";
    console.log('Reassign: Using tutorName:', tutorName, 'for user:', currentUser.email);

    const q = query(bookingsRef, where('tutor', '==', tutorName));
    const snapshot = await getDocs(q);
    console.log('Reassign: Found', snapshot.size, 'bookings for tutor', tutorName);
    let substitutions = 0;
    for (const bookingDoc of snapshot.docs) {
      const booking = bookingDoc.data();
      const bookingDate = new Date(booking.date);
      if (bookingDate < now) continue; // Only future bookings
      const day = booking.day;
      const time = booking.time;
      const recurringKey = `${day}-${time}`;
      const weekKey = `${day}-${time}-${startOfWeek(bookingDate, { weekStartsOn: 1 }).getTime()}`;
      console.log('Checking booking', bookingDoc.id, 'for conflict:', {recurringKey, weekKey, unavailableSlots});
      if (unavailableSlots[recurringKey] || unavailableSlots[weekKey]) {
        // Find a substitute
        const result = await assignTutorPersistent({ day, time }, booking.childId, booking.course, bookingDate);
        if (typeof result === 'object' && result.tutor && result.busyTutor) {
          await updateDoc(doc(db, 'bookings', bookingDoc.id), {
            tutor: result.tutor,
            busyTutor: result.busyTutor
          });
          substitutions++;
          console.log(`Booking ${bookingDoc.id} reassigned to substitute:`, result.tutor);
        } else {
          console.log(`Booking ${bookingDoc.id} could not be reassigned (no available substitute).`);
        }
      } else {
        console.log(`Booking ${bookingDoc.id} does not conflict with blocked slots.`);
      }
    }
    // Check for lessons where this tutor is the busyTutor and the slot is now available
    const qBusy = query(bookingsRef, where('busyTutor', '==', tutorName));
    const busySnapshot = await getDocs(qBusy);
    let restorations = 0;
    for (const bookingDoc of busySnapshot.docs) {
      const booking = bookingDoc.data();
      const bookingDate = new Date(booking.date);
      if (bookingDate < now) continue; // Only future bookings
      const day = booking.day;
      const time = booking.time;
      const recurringKey = `${day}-${time}`;
      const weekKey = `${day}-${time}-${startOfWeek(bookingDate, { weekStartsOn: 1 }).getTime()}`;
      const isBlocked = unavailableSlots[recurringKey] || unavailableSlots[weekKey];
      if (!isBlocked && booking.tutor !== tutorName) {
        // Restore lesson to original tutor
        await updateDoc(doc(db, 'bookings', bookingDoc.id), {
          tutor: tutorName,
          busyTutor: null
        });
        restorations++;
        console.log(`Booking ${bookingDoc.id} restored to original tutor:`, tutorName);
      }
    }
    if (substitutions > 0 || restorations > 0) {
      alert(`${substitutions + restorations} lesson(s) were reassigned or restored due to your new availability.`);
    } else {
      console.log('No substitutions or restorations were necessary.');
    }
  } catch (error) {
    console.error('Error reassigning conflicting lessons:', error);
  }
}

export default function WeeklySchedule() {
  const [unavailableSlots, setUnavailableSlots] = useState({});
  const [selectedWeek, setSelectedWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const { currentUser } = useAuth();

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Fetch schedule from Firestore
  useEffect(() => {
    if (!currentUser) return;
    const fetchSchedule = async () => {
      try {
        const ref = doc(db, 'tutorSchedules', currentUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          console.log('Fetched unavailableSlots from Firestore:', data.unavailableSlots);
          setUnavailableSlots(data.unavailableSlots || {});
        } else {
          console.log('No schedule found in Firestore for UID:', currentUser.uid);
          setUnavailableSlots({});
        }
      } catch (error) {
        console.error('Error fetching schedule:', error);
      }
    };
    fetchSchedule();
  }, [currentUser]);

  const saveSchedule = async () => {
    if (!currentUser) {
      console.log('No current user, cannot save schedule');
      alert('No current user, cannot save schedule');
      return;
    }
    setIsSaving(true);
    try {
      const uid = currentUser.uid;
      const docPath = `tutorSchedules/${uid}`;
      console.log('Saving schedule for UID:', uid);
      console.log('Document path:', docPath);
      console.log('Unavailable slots to save (right before save):', unavailableSlots);
      const ref = doc(db, 'tutorSchedules', uid);
      await setDoc(ref, { unavailableSlots });
      console.log('Schedule saved successfully');
      alert('Schedule saved successfully!');
      // Fetch again after save to confirm
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        console.log('Fetched unavailableSlots from Firestore after save:', data.unavailableSlots);
      }
      // Reassign conflicting lessons after saving
      await reassignConflictingLessons(currentUser, unavailableSlots);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule. Error: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSlot = (day, time) => {
    const key = `${day}-${time}`;
    const weekKey = `${key}-${selectedWeek.getTime().toString()}`;
    console.log('Toggling slot:', { day, time, weekKey });
    setUnavailableSlots(prev => {
      const newState = { ...prev };
      const currentState = prev[weekKey] || prev[key];
      console.log('Current state:', currentState);

      if (!currentState) {
        // First click: Make unavailable for this week only
        newState[weekKey] = 'unavailable';
        console.log('Setting to unavailable for this week');
      } else if (currentState === 'unavailable') {
        // Second click: Make recurring
        delete newState[weekKey];
        newState[key] = 'recurring';
        console.log('Setting to recurring');
      } else if (currentState === 'recurring') {
        // Third click: Remove completely
        if (newState[key]) {
          delete newState[key];
          console.log('Deleted recurring key:', key);
        }
        // Delete all week-specific keys for this slot
        const weekKeyPrefix = `${day}-${time}-`;
        Object.keys(newState).forEach(k => {
          if (k.startsWith(weekKeyPrefix)) {
            delete newState[k];
            console.log('Deleted week-specific key:', k);
          }
        });
        console.log('Removing slot');
      }
      
      console.log('New state:', newState);
      return newState;
    });
  };

  const getNextWeek = () => {
    setSelectedWeek(prev => addDays(prev, 7));
  };

  const getPrevWeek = () => {
    setSelectedWeek(prev => addDays(prev, -7));
  };

  const resetToToday = () => {
    setSelectedWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Helper to highlight current time slot if today is in view
  const today = currentTime;
  const todayDay = DAYS[today.getDay() === 0 ? 6 : today.getDay() - 1]; // Monday=0
  const isCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }).getTime() === selectedWeek.getTime();

  // Mini calendar for the week
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i));

  const getSlotState = (day, time) => {
    const key = `${day}-${time}`;
    const weekKey = `${key}-${selectedWeek.getTime().toString()}`;
    return unavailableSlots[weekKey] || unavailableSlots[key];
  };

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col lg:flex-row gap-8">
      {/* Sidebar summary */}
      <aside className="w-full lg:w-64 mb-6 lg:mb-0 flex-shrink-0">
        <div className="bg-blue-50 rounded-xl shadow p-4 mb-6">
          <div className="text-lg font-bold text-blue-900 mb-2">Week</div>
          <div className="text-blue-700 font-semibold mb-2">{getWeekRange(selectedWeek)}</div>
          <div className="flex gap-2 mb-2">
            <button onClick={getPrevWeek} className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition">◀</button>
            <button onClick={resetToToday} className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition">Today</button>
            <button onClick={getNextWeek} className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition">▶</button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="text-lg font-bold text-blue-900 mb-2">Mini Calendar</div>
          <div className="flex flex-wrap gap-2">
            {weekDates.map((date, i) => (
              <div key={i} className={`flex flex-col items-center px-2 py-1 rounded-lg ${isToday(date) ? 'bg-yellow-100 text-yellow-800 font-bold' : 'bg-gray-100 text-gray-700'}`}>
                <span className="text-xs">{DAYS[i].slice(0, 3)}</span>
                <span className="text-base">{format(date, 'd')}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-xl shadow p-4 mt-6 text-center text-blue-800 italic text-sm">
          “{quote}”
        </div>
      </aside>
      {/* Main schedule grid */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-blue-900">Weekly Schedule</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">{getWeekRange(selectedWeek)}</div>
            <button 
              onClick={saveSchedule}
              disabled={isSaving}
              className={`px-4 py-2 rounded font-medium transition ${
                isSaving 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-4 bg-gray-50 border-b sticky left-0 z-10"></th>
                {DAYS.map(day => (
                  <th key={day} className="p-4 bg-gray-50 border-b text-center sticky top-0 z-10">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map(time => (
                <tr key={time}>
                  <td className="p-4 border-b text-center font-medium bg-gray-50 sticky left-0 z-10">{time}</td>
                  {DAYS.map(day => {
                    const slotState = getSlotState(day, time);
                    const isUnavailable = slotState === 'unavailable';
                    const isRecurring = slotState === 'recurring';
                    // Highlight current time slot
                    let highlight = '';
                    if (isCurrentWeek && day === todayDay) {
                      const now = today.getHours() * 60 + today.getMinutes();
                      let hour = parseInt(time.split(':')[0]);
                      let minute = parseInt(time.split(':')[1]);
                      if (time.includes('PM') && hour !== 12) hour += 12;
                      if (time.includes('AM') && hour === 12) hour = 0;
                      const slotStart = hour * 60 + minute;
                      if (now >= slotStart && now < slotStart + 60) {
                        highlight = 'bg-yellow-200 border-yellow-400';
                      }
                    }
                    return (
                      <td
                        key={`${day}-${time}`}
                        className={`p-4 border-b cursor-pointer transition-all duration-200 select-none text-center border relative group ${
                          isRecurring
                            ? 'bg-gradient-to-br from-blue-200 to-blue-100 border-blue-400 hover:from-blue-300 hover:to-blue-200'
                            : isUnavailable
                              ? 'bg-gradient-to-br from-red-200 to-red-100 border-red-400 hover:from-red-300 hover:to-red-200'
                              : highlight
                                ? `${highlight} hover:bg-yellow-300`
                                : 'bg-green-200 border-green-400 hover:bg-green-300'
                        }`}
                        onClick={() => toggleSlot(day, time)}
                        title={isUnavailable ? 'Unavailable' : 'Available'}
                        onMouseEnter={() => setHoveredSlot(`${day}-${time}`)}
                        onMouseLeave={() => setHoveredSlot(null)}
                      >
                        <span className={`inline-block transition-transform duration-200 ${isUnavailable || isRecurring ? 'scale-110' : ''}`}>
                          {isRecurring ? '🔄' : isUnavailable ? '❌' : highlight ? '⏰' : '✔️'}
                        </span>
                        {/* Floating tooltip */}
                        {hoveredSlot === `${day}-${time}` && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white border border-gray-300 rounded shadow-lg px-3 py-2 text-xs text-gray-800 z-20 whitespace-nowrap animate-fade-in">
                            {day}, {time} <br />
                            {isRecurring 
                              ? 'Recurring Unavailable'
                              : isUnavailable 
                                ? 'Unavailable'
                                : 'Available'
                            }
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 