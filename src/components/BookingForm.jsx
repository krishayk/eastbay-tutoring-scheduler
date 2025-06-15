import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { courses } from '../data/courses';
import { format, startOfWeek, endOfWeek, isSameDay, addWeeks, addDays, isBefore, isAfter, addHours } from 'date-fns';
import { packages } from '../data/packages';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../utils/AuthContext';
import { assignTutorPersistent, tutorAvailability } from '../utils/scheduler';

export default function BookingForm({ bookings, onBook, userProfile, onGoToSettings }) {
  const [selectedChild, setSelectedChild] = useState('');
  const [children, setChildren] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [otherCourse, setOtherCourse] = useState('');
  const [specificCourse, setSpecificCourse] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [mathCourse, setMathCourse] = useState('');
  const [gradeError, setGradeError] = useState('');
  const { currentUser } = useAuth();

  const allTimes = generateTimes();

  // Find user's package info
  const userPackage = userProfile && packages.find(p => p.id === userProfile.packageId);
  // Helper to count bookings for a week
  function countBookingsForWeek(date) {
    return bookings.filter(b => b.userId === userProfile?.id && isSameWeek(new Date(b.date), date)).length;
  }
  const canBook = (() => {
    if (!userProfile || !userProfile.verified || !userPackage) return false;
    if (!selectedDate) return true;
    if (recurring) {
      // Check all 4 weeks
      for (let i = 0; i < 4; i++) {
        const recurDate = addWeeks(selectedDate, i);
        if (countBookingsForWeek(recurDate) + 1 > userPackage.sessionsPerWeek) return false;
      }
      return true;
    } else {
      return countBookingsForWeek(selectedDate) < userPackage.sessionsPerWeek;
    }
  })();

  // Fetch children from Firestore
  useEffect(() => {
    const fetchChildren = async () => {
      if (currentUser) {
        const q = query(
          collection(db, 'children'),
          where('userId', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const childrenList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setChildren(childrenList);
      }
    };
    fetchChildren();
  }, [currentUser]);

  // Only allow dates within the current week and 24+ hours in advance
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

  // Generate next 7 days
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(tomorrow, i);
    return {
      date,
      formatted: format(date, 'EEEE, MMMM d'),
      short: format(date, 'EEE, MMM d')
    };
  });

  // Only show available times for the selected date
  const bookedTimes = selectedDate
    ? bookings.filter(b => isSameDay(new Date(b.date), selectedDate)).map(b => b.time)
    : [];

  // Filter available times: only show times where at least one tutor is available
  const availableTimes = allTimes.filter(time => {
    const day = selectedDate ? format(selectedDate, 'EEEE') : null;
    if (!day) return true; // If no day selected, show all
    // Check if at least one tutor is available
    return ["Krishay", "Om", "Tejas"].some(tutor => tutorAvailability[tutor](day, time));
  });

  const selectedChildData = children.find(c => c.id === selectedChild);
  const isHighSchoolMath = selectedCourse === 'Math' && userPackage?.name.toLowerCase().includes('high school');
  const isHighSchoolPackage = userPackage?.name.toLowerCase().includes('high school');
  const needsSpecificCourse = isHighSchoolPackage && [
    'English',
    'Math',
    'Science',
    'Sciences (including Physics)',
    'History',
    'World Language',
    'Computer Science',
  ].includes(selectedCourse);
  const isOther = selectedCourse === 'Other';

  // Check if child's grade matches package requirements
  const validateGrade = (child) => {
    if (!child || !userPackage) return true;
    
    const grade = parseInt(child.grade);
    const isHighSchool = grade >= 9;
    const isAP = userPackage.name.toLowerCase().includes('ap/honors');
    const isHighSchoolPackage = userPackage.name.toLowerCase().includes('high school');
    
    if (isHighSchoolPackage && !isHighSchool) {
      setGradeError('This package is for high school students only');
      return false;
    }
    if (isAP && grade < 9) {
      setGradeError('AP/Honors package is for high school students only');
      return false;
    }
    if (!isHighSchoolPackage && isHighSchool) {
      setGradeError('This package is for elementary/middle school students only');
      return false;
    }
    
    setGradeError('');
    return true;
  };

  const handleChildSelect = (childId) => {
    setSelectedChild(childId);
    const child = children.find(c => c.id === childId);
    if (child) {
      validateGrade(child);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Recurring:', recurring);
    if (!selectedChild || !selectedCourse || !selectedDate || !selectedTime) {
      alert('Please fill in all required fields.');
      return;
    }

    const child = children.find(c => c.id === selectedChild);
    if (!validateGrade(child)) return;

    const course = specificCourse || otherCourse || selectedCourse;
    const timeObj = { day: format(selectedDate, 'EEEE'), time: selectedTime };

    try {
      let assignedTutor = await assignTutorPersistent(timeObj, selectedChild, course, selectedDate);
      let busyTutor = null;
      if (typeof assignedTutor === 'object' && assignedTutor.tutor && assignedTutor.busyTutor) {
        busyTutor = assignedTutor.busyTutor;
        assignedTutor = assignedTutor.tutor;
      }
      if (assignedTutor === "No Available Tutor") {
        alert('No tutors available for this time slot.');
        return;
      }

      const bookingData = {
        userId: currentUser.uid,
        childId: selectedChild,
        child: child.name,
        grade: child.grade,
        course,
        day: timeObj.day,
        date: selectedDate.toISOString(),
        time: selectedTime,
        tutor: assignedTutor,
        busyTutor,
        createdAt: new Date().toISOString()
      };

      if (recurring) {
        for (let i = 0; i < 4; i++) {
          const recurDate = addWeeks(selectedDate, i);
          const recurTimeObj = { day: format(recurDate, 'EEEE'), time: selectedTime };
          let recurTutor = assignedTutor;
          let recurBusyTutor = busyTutor;
          let recurResult = await assignTutorPersistent(recurTimeObj, selectedChild, course, recurDate);
          if (typeof recurResult === 'object' && recurResult.tutor && recurResult.busyTutor) {
            recurTutor = recurResult.tutor;
            recurBusyTutor = recurResult.busyTutor;
          } else if (recurResult === "No Available Tutor") {
            alert(`No tutors available for week ${i + 1}. Please try a different time.`);
            return;
          } else {
            recurTutor = recurResult;
            recurBusyTutor = null;
          }
          await onBook({
            ...bookingData,
            date: recurDate.toISOString(),
            tutor: recurTutor,
            busyTutor: recurBusyTutor || null
          });
        }
      } else {
        await onBook({
          ...bookingData,
          tutor: assignedTutor,
          busyTutor: busyTutor || null
        });
      }

      // Reset form
      setSelectedChild('');
      setSelectedCourse('');
      setOtherCourse('');
      setSpecificCourse('');
      setSelectedDate(null);
      setSelectedTime('');
      setRecurring(false);
    } catch (error) {
      console.error('Error booking session:', error);
      alert('Failed to book session. Please try again.');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row justify-center items-start gap-4 sm:gap-8 w-full max-w-4xl mx-auto mt-4 sm:mt-10">
      {/* Calendar Column */}
      <div className="bg-white rounded-2xl shadow-lg p-6 min-w-[320px] flex flex-col items-center">
        <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <span className="text-yellow-500">📅</span> Book your lesson
        </h2>
        <div className="w-full">
          <div className="grid grid-cols-1 gap-2">
            {availableDates.map(({ date, formatted, short }) => (
              <button
                type="button"
                key={formatted}
                className={`rounded-full px-4 py-2 text-center font-semibold border transition-all ${
                  selectedDate && isSameDay(selectedDate, date)
                    ? 'bg-blue-700 text-white'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
                onClick={() => setSelectedDate(date)}
              >
                {short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Time Selection & Form Column */}
      <div className="flex flex-col gap-6 min-w-[260px]">
        {!userProfile?.verified && (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded mb-4 text-center font-semibold">
            Your account is not verified. Please wait for admin approval after payment.
          </div>
        )}
        {userProfile?.verified && userPackage && !canBook && (
          <div className="bg-red-100 text-red-800 p-4 rounded mb-4 text-center font-semibold">
            You have reached your weekly booking limit for your package.
          </div>
        )}
        {children.length === 0 && (
          <div className="bg-red-100 text-red-800 p-4 rounded mb-4 text-center font-semibold">
            You have not added any children yet. Please go to{' '}
            <button
              type="button"
              className="underline font-bold text-red-800 hover:text-red-600"
              onClick={onGoToSettings}
            >
              Settings
            </button>{' '}
            and add a child before booking a lesson.
          </div>
        )}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4" disabled={children.length === 0}>
          <h3 className="text-lg font-bold text-blue-900 mb-2">Schedule a lesson</h3>
          
          <select
            value={selectedChild}
            onChange={(e) => handleChildSelect(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white"
            required
          >
            <option value="">Select a Child</option>
            {children.map(child => (
              <option key={child.id} value={child.id}>
                {child.name} (Grade {child.grade})
              </option>
            ))}
          </select>
          {gradeError && (
            <div className="text-red-600 text-sm">{gradeError}</div>
          )}

          <select
            value={selectedCourse}
            onChange={e => {
              setSelectedCourse(e.target.value);
              setOtherCourse('');
              setSpecificCourse('');
            }}
            className="w-full p-3 rounded-md border border-blue-200 bg-white"
            required
          >
            <option value="">Select a Course</option>
            {courses.map(c => <option key={c}>{c}</option>)}
            <option value="Other">Other</option>
          </select>
          {isOther && (
            <input
              type="text"
              placeholder="Please specify the course"
              value={otherCourse}
              onChange={e => setOtherCourse(e.target.value)}
              className="w-full p-3 rounded-md border border-blue-200 bg-white mt-2"
              required
            />
          )}
          {needsSpecificCourse && (
            <input
              type="text"
              placeholder={`Please specify the specific ${selectedCourse} course (e.g., Algebra II, AP English)`}
              value={specificCourse}
              onChange={e => setSpecificCourse(e.target.value)}
              className="w-full p-3 rounded-md border border-blue-200 bg-white mt-2"
              required
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pick a time</label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={selectedTime}
              onChange={e => setSelectedTime(e.target.value)}
              required
            >
              <option value="">Select a time</option>
              {availableTimes.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            Make this a recurring weekly lesson (next 4 weeks)
          </label>

          <button
            type="submit"
            className="w-full mt-4 bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold py-3 rounded-lg transition-all"
            disabled={!canBook || !selectedTime || !selectedDate || availableTimes.length === 0 || !selectedChild || !selectedCourse || !!gradeError}
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