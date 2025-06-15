// /src/utils/scheduler.js
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { startOfWeek } from 'date-fns';

const tutors = ["Krishay", "Om", "Tejas"];

export const tutorAvailability = {
  Krishay: () => true,
  Om: (day, time) => {
    if (["Monday", "Tuesday", "Wednesday", "Thursday"].includes(day)) {
      let hour, minute;
      if (time.includes('AM') || time.includes('PM')) {
        // 12-hour format, e.g. '1:00 PM'
        const [t, meridian] = time.split(' ');
        [hour, minute] = t.split(':').map(Number);
        if (meridian === 'PM' && hour !== 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
      } else {
        // 24-hour format, e.g. '13:00'
        [hour, minute] = time.split(':').map(Number);
      }
      const total = hour * 60 + minute;
      // 13:00 (1:00 PM) = 780, 16:30 (4:30 PM) = 990
      return total < 13 * 60 || total > 16 * 60 + 30;
    }
    return true;
  },
  Tejas: () => true,
};

let tutorCycle = [0, 1, 2];
const usageCount = [0, 0, 0];

// New async version for persistent, all-time even distribution
export async function assignTutorPersistent(timeObj, childId, course, bookingDate) {
  const { day, time } = timeObj;
  // Compute the week start timestamp for the booking date
  let weekStartTs = null;
  if (bookingDate) {
    weekStartTs = startOfWeek(new Date(bookingDate), { weekStartsOn: 1 }).getTime();
  }
  
  console.log('Checking availability for:', { day, time, bookingDate, weekStartTs });
  
  // 1. Check if there's an existing tutor for this child-subject pair
  if (childId && course) {
    const existingBookingQuery = query(
      collection(db, 'bookings'),
      where('childId', '==', childId),
      where('course', '==', course)
    );
    const existingBookings = await getDocs(existingBookingQuery);
    
    if (!existingBookings.empty) {
      const existingTutor = existingBookings.docs[0].data().tutor;
      console.log('Found existing tutor:', existingTutor);
      
      // Check Firestore for tutor's unavailable slots
      const tutorUid = getTutorUid(existingTutor);
      console.log('Looking up tutor schedule with UID:', tutorUid);
      
      const scheduleSnap = await getDoc(doc(db, 'tutorSchedules', tutorUid));
      let isBusy = false;
      if (scheduleSnap.exists()) {
        const unavailableSlots = scheduleSnap.data().unavailableSlots || {};
        console.log('Found unavailable slots:', unavailableSlots);
        
        // Check both recurring and week-specific keys for the correct week
        const recurringKey = `${day}-${time}`;
        const weekKey = weekStartTs !== null ? getWeekKey(day, time, weekStartTs.toString()) : null;
        console.log('Checking keys:', { recurringKey, weekKey });
        
        if (unavailableSlots[recurringKey] || (weekKey && unavailableSlots[weekKey])) {
          console.log('Tutor is busy! Found match in:', unavailableSlots[recurringKey] ? 'recurring' : 'week-specific');
          isBusy = true;
        }
      } else {
        console.log('No schedule found for tutor');
      }
      
      if (!isBusy) {
        console.log('Tutor is available, returning:', existingTutor);
        return existingTutor;
      } else {
        console.log('Tutor is busy, looking for substitute...');
        // Find a substitute
        const availableTutors = tutors.filter(tutor => tutor !== existingTutor);
        for (const subTutor of availableTutors) {
          const subUid = getTutorUid(subTutor);
          console.log('Checking substitute tutor:', subTutor, 'with UID:', subUid);
          
          const subSnap = await getDoc(doc(db, 'tutorSchedules', subUid));
          let subBusy = false;
          if (subSnap.exists()) {
            const subUnavailable = subSnap.data().unavailableSlots || {};
            console.log('Found substitute unavailable slots:', subUnavailable);
            
            const recurringKey = `${day}-${time}`;
            const weekKey = weekStartTs !== null ? getWeekKey(day, time, weekStartTs.toString()) : null;
            if (subUnavailable[recurringKey] || (weekKey && subUnavailable[weekKey])) {
              console.log('Substitute is busy');
              subBusy = true;
            }
          }
          if (!subBusy) {
            console.log('Found available substitute:', subTutor);
            return { tutor: subTutor, busyTutor: existingTutor };
          }
        }
        console.log('No available substitutes found');
        return "No Available Tutor";
      }
    }
  }

  // 2. If no existing tutor or existing tutor unavailable, proceed with normal assignment
  for (const tutor of tutors) {
    const scheduleSnap = await getDoc(doc(db, 'tutorSchedules', getTutorUid(tutor)));
    let isBusy = false;
    if (scheduleSnap.exists()) {
      const unavailableSlots = scheduleSnap.data().unavailableSlots || {};
      const recurringKey = `${day}-${time}`;
      const weekKey = weekStartTs !== null ? getWeekKey(day, time, weekStartTs.toString()) : null;
      if (unavailableSlots[recurringKey] || (weekKey && unavailableSlots[weekKey])) isBusy = true;
    }
    if (!isBusy) {
      return tutor;
    }
  }
  return "No Available Tutor";
}

// Map tutor names to their Firebase UIDs
const TUTOR_NAME_TO_UID = {
  Krishay: 'Y48lor8WXObmSEGPka99lmjbXs02', // Actual Firebase UID
  Om: 'omUID', // TODO: Replace with actual UID
  Tejas: 'tejasUID', // TODO: Replace with actual UID
};

function getTutorUid(tutorName) {
  return TUTOR_NAME_TO_UID[tutorName] || '';
}

export function assignTutor(timeObj, currentBookings) {
  const { day, time } = timeObj;
  let i = 0;
  while (i < 3) {
    const idx = tutorCycle[0];
    const tutor = tutors[idx];
    if (tutorAvailability[tutor](day, time)) {
      usageCount[idx]++;
      rotateCycle();
      return tutor;
    } else {
      rotateCycle();
      i++;
    }
  }
  return "No Available Tutor";
}

function rotateCycle() {
  tutorCycle.push(tutorCycle.shift());
}

export function generateSchedule() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const times = [
    ...generateSlots(8, 30, 12, 30),
    ...generateSlots(13, 30, 19, 30),
  ];
  return days.flatMap(day => times.map(time => ({ day, time })));
}

function generateSlots(startHour, startMin, endHour, endMin) {
  const slots = [];
  let current = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  while (current + 59 <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += 60;
  }
  return slots;
}

// Helper to get week key as string
function getWeekKey(day, time, weekStartTs) {
  return `${day}-${time}-${weekStartTs}`;
}