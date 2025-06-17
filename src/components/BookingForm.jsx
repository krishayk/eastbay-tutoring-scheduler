import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { courses } from '../data/courses';
import { format, startOfWeek, endOfWeek, isSameDay, addWeeks, addDays, isBefore, isAfter, addHours } from 'date-fns';
import { packages } from '../data/packages';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
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
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [weeksToBook, setWeeksToBook] = useState(4);
  const [isPermanent, setIsPermanent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState('');
  const [selectedTutorId, setSelectedTutorId] = useState('');
  const [tutorUnavailableSlots, setTutorUnavailableSlots] = useState({});

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

  // Remove already booked times for the selected date
  const bookedTimes = bookings
    .filter(b => b.date && selectedDate && new Date(b.date).toDateString() === selectedDate.toDateString())
    .map(b => b.time);

  // Fetch unavailable slots and tutorId for selected tutor
  useEffect(() => {
    const fetchTutorUnavailable = async () => {
      if (!selectedTutor) {
        setTutorUnavailableSlots({});
        setSelectedTutorId('');
        return;
      }
      // Find the tutor's user document by name
      const tutorsQuery = query(collection(db, 'users'), where('name', '==', selectedTutor));
      const tutorsSnap = await getDocs(tutorsQuery);
      if (!tutorsSnap.empty) {
        const tutorDoc = tutorsSnap.docs[0];
        setSelectedTutorId(tutorDoc.id);
        const scheduleRef = doc(db, 'tutorSchedules', tutorDoc.id);
        const scheduleSnap = await getDoc(scheduleRef);
        if (scheduleSnap.exists()) {
          setTutorUnavailableSlots(scheduleSnap.data().unavailableSlots || {});
        } else {
          setTutorUnavailableSlots({});
        }
      } else {
        setTutorUnavailableSlots({});
        setSelectedTutorId('');
      }
    };
    fetchTutorUnavailable();
  }, [selectedTutor]);

  // Filter available times: only show times where at least one tutor is available, at least 24 hours from now, and not blocked for selected tutor
  const availableTimes = allTimes.filter(time => {
    const day = selectedDate ? format(selectedDate, 'EEEE') : null;
    if (!day) return true; // If no day selected, show all
    // Exclude times already booked
    if (bookedTimes.includes(time)) return false;
    // Exclude times less than 24 hours from now
    if (selectedDate) {
      const [hour, minute, meridian] = time.match(/(\d+):(\d+) (AM|PM)/).slice(1);
      let h = parseInt(hour, 10);
      if (meridian === 'PM' && h !== 12) h += 12;
      if (meridian === 'AM' && h === 12) h = 0;
      const slotDate = new Date(selectedDate);
      slotDate.setHours(h, parseInt(minute, 10), 0, 0);
      if (isBefore(slotDate, addHours(new Date(), 24))) return false;
    }
    // If a tutor is selected, filter out their blocked slots (unavailable or recurring for both weekKey and key)
    if (selectedTutor && day) {
      const key = `${day}-${time}`;
      const weekKey = `${key}-${startOfWeek(selectedDate, { weekStartsOn: 1 }).getTime()}`;
      if (
        tutorUnavailableSlots[weekKey] === 'unavailable' ||
        tutorUnavailableSlots[weekKey] === 'recurring' ||
        tutorUnavailableSlots[key] === 'unavailable' ||
        tutorUnavailableSlots[key] === 'recurring'
      ) return false;
    }
    // Otherwise, check if at least one tutor is available
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

  useEffect(() => {
    // Autofill tutor if permanent tutor exists for selected course
    const fetchPermanentTutor = async () => {
      if (!currentUser || !selectedCourse) return;
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      if (userData && userData.permanentTutors && userData.permanentTutors[selectedCourse]) {
        setSelectedTutor(userData.permanentTutors[selectedCourse]);
      }
    };
    fetchPermanentTutor();
  }, [currentUser, selectedCourse]);

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

    setLoading(true);
    try {
      let assignedTutor = selectedTutor;
      let assignedTutorId = selectedTutorId;
      let busyTutor = null;

      if (!selectedTutor) {
        // Only auto-assign if user didn't pick a tutor
        let autoAssign = await assignTutorPersistent(timeObj, selectedChild, course, selectedDate);
        if (typeof autoAssign === 'object' && autoAssign.tutor && autoAssign.busyTutor) {
          busyTutor = autoAssign.busyTutor;
          assignedTutor = autoAssign.tutor;
        } else {
          assignedTutor = autoAssign;
        }
        // Look up tutorId by name if needed
        if (assignedTutor) {
          const tutorsQuery = query(collection(db, 'users'), where('name', '==', assignedTutor));
          const tutorsSnap = await getDocs(tutorsQuery);
          if (!tutorsSnap.empty) {
            assignedTutorId = tutorsSnap.docs[0].id;
          }
        }
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
        tutorId: assignedTutorId,
        busyTutor,
        createdAt: new Date().toISOString(),
        isRecurring: recurring,
        isPermanent
      };

      if (recurring) {
        for (let i = 0; i < 4; i++) {
          const recurDate = addWeeks(selectedDate, i);
          const recurTimeObj = { day: format(recurDate, 'EEEE'), time: selectedTime };
          let recurTutor = assignedTutor;
          let recurTutorId = assignedTutorId;
          let recurBusyTutor = busyTutor;
          if (!selectedTutor) {
            let recurResult = await assignTutorPersistent(recurTimeObj, selectedChild, course, recurDate);
            if (typeof recurResult === 'object' && recurResult.tutor && recurResult.busyTutor) {
              recurTutor = recurResult.tutor;
              recurBusyTutor = recurResult.busyTutor;
            } else {
              recurTutor = recurResult;
              recurBusyTutor = null;
            }
            // Look up tutorId by name if needed
            if (recurTutor) {
              const tutorsQuery = query(collection(db, 'users'), where('name', '==', recurTutor));
              const tutorsSnap = await getDocs(tutorsQuery);
              if (!tutorsSnap.empty) {
                recurTutorId = tutorsSnap.docs[0].id;
              }
            }
          }
          await addDoc(collection(db, 'bookings'), {
            ...bookingData,
            date: recurDate.toISOString(),
            tutor: recurTutor,
            tutorId: recurTutorId,
            busyTutor: recurBusyTutor || null
          });
        }
      } else {
        await addDoc(collection(db, 'bookings'), {
          ...bookingData,
          tutor: assignedTutor,
          tutorId: assignedTutorId,
          busyTutor: busyTutor || null
        });
      }

      // If it's a permanent booking, update the user's permanent tutors
      if (isPermanent && selectedTutor) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        const permanentTutors = userData.permanentTutors || {};
        permanentTutors[course] = selectedTutor;
        await updateDoc(userRef, { permanentTutors });
      }

      // Reset form
      setSelectedChild('');
      setSelectedCourse('');
      setOtherCourse('');
      setSpecificCourse('');
      setSelectedDate(null);
      setSelectedTime('');
      setRecurring(false);
      setIsRecurring(false);
      setWeeksToBook(4);
      setIsPermanent(false);
    } catch (error) {
      console.error('Error booking session:', error);
      alert('Failed to book session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="flex flex-row flex-nowrap justify-center items-start gap-8 w-full max-w-4xl mx-auto mt-4 sm:mt-10">
      {/* Calendar Column */}
      <div className="bg-white rounded-2xl shadow-lg p-10 min-w-[380px] flex flex-col items-center">
        <h2 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-2">Pick a date</h2>
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
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-8 flex flex-col gap-6">
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Schedule a Lesson (1 Hour)</h2>
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
          <select
            value={selectedTutor}
            onChange={e => setSelectedTutor(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white"
            required
          >
            <option value="">Select a Tutor</option>
            <option value="Krishay">Krishay</option>
            <option value="Om">Om</option>
            <option value="Tejas">Tejas</option>
          </select>
          <div>
            <div className="grid grid-cols-2 gap-2">
              {availableTimes.length === 0 && <div className="text-gray-500 col-span-2">No available times for this date.</div>}
              {availableTimes.map(t => (
                <button
                  type="button"
                  key={t}
                  className={`rounded-full px-4 py-2 text-center font-semibold border transition-all ${selectedTime === t ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                  onClick={() => setSelectedTime(t)}
                >
                  {t} - {getEndTime(t)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
            Make this a recurring weekly lesson (next 4 weeks)
          </label>
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={isPermanent} onChange={e => setIsPermanent(e.target.checked)} />
            Set as permanent tutor for this subject
          </label>
          {isRecurring && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Number of weeks</label>
              <input
                type="number"
                min="1"
                max="12"
                value={weeksToBook}
                onChange={(e) => setWeeksToBook(parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-blue-900 font-bold py-3 px-6 rounded-lg shadow transition-all text-lg mt-4 disabled:opacity-50"
            disabled={!canBook || children.length === 0 || loading}
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
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