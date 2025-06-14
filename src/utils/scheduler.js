// /src/utils/scheduler.js
const tutors = ["Krishay", "Om", "Tejas"];

const tutorAvailability = {
  Krishay: () => true,
  Om: (day, time) => {
    if (["Monday", "Tuesday", "Wednesday", "Thursday"].includes(day)) {
      const [h, m] = time.split(":");
      const total = parseInt(h) * 60 + parseInt(m);
      return total < 13 * 60 + 30 || total >= 16 * 60 + 30;
    }
    return true;
  },
  Tejas: () => true,
};

let tutorCycle = [0, 1, 2];
const usageCount = [0, 0, 0];

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