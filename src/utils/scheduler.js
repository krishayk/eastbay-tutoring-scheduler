// /src/utils/scheduler.js
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const tutors = ["Krishay", "Om", "Tejas"];

const tutorAvailability = {
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
export async function assignTutorPersistent(timeObj) {
  const { day, time } = timeObj;
  // 1. Filter available tutors
  const availableTutors = tutors.filter(tutor => tutorAvailability[tutor](day, time));
  if (availableTutors.length === 0) return "No Available Tutor";

  // 2. Count lessons for each available tutor
  const counts = {};
  for (const tutor of availableTutors) {
    const q = query(collection(db, 'bookings'), where('tutor', '==', tutor));
    const snapshot = await getDocs(q);
    counts[tutor] = snapshot.size;
  }

  // 3. Find tutor(s) with the minimum count
  const minCount = Math.min(...Object.values(counts));
  const leastBusyTutors = availableTutors.filter(tutor => counts[tutor] === minCount);

  // 4. If tie, pick randomly among least busy
  const assignedTutor = leastBusyTutors[Math.floor(Math.random() * leastBusyTutors.length)];
  return assignedTutor;
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