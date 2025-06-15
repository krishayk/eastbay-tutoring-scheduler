import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../utils/AuthContext';
import { format, startOfWeek } from 'date-fns';
import { FaCalendarAlt, FaClock, FaUser } from 'react-icons/fa';

console.log('🔥🔥🔥 MyLessons component is mounted! 🔥🔥🔥');

const TUTOR_EMAILS = [
  'krishay.k.30@gmail.com',
  'omjoshi823@gmail.com',
  'kanneboinatejas@gmail.com'
];

export default function MyLessons({ tutorMode = false, tutorName, tutorEmail, oauthChecked }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchLessons = async () => {
      if (!currentUser) {
        console.log('No currentUser in MyLessons');
        setLoading(false);
        return;
      }
      try {
        console.log('Current user:', currentUser);
        let q;
        if (tutorMode && tutorName) {
          // Debug log for tutorName
          console.log('Filtering lessons for tutor:', tutorName);
          // Case-insensitive filter workaround: fetch all, then filter in JS
          q = query(collection(db, 'bookings'), orderBy('date', 'asc'));
          const querySnapshot = await getDocs(q);
          const lessonsList = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(lesson => lesson.tutor && lesson.tutor.toLowerCase() === tutorName.toLowerCase());
          setLessons(lessonsList);
          setLoading(false);
          return;
        } else {
          // Regular user: show their own lessons
          q = query(collection(db, 'bookings'), where('userId', '==', currentUser.uid), orderBy('date', 'asc'));
        }
        const querySnapshot = await getDocs(q);
        const lessonsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('Fetched lessons:', lessonsList);
        setLessons(lessonsList);
      } catch (error) {
        console.error('Error fetching lessons:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLessons();
  }, [currentUser, tutorMode, tutorName]);

  // Group lessons by week
  const groupLessonsByWeek = (lessons) => {
    const grouped = {};
    lessons.forEach(lesson => {
      // Robust date handling: Firestore Timestamp or string
      const lessonDate = lesson.date && lesson.date.toDate ? lesson.date.toDate() : new Date(lesson.date);
      const weekStart = startOfWeek(lessonDate, { weekStartsOn: 0 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      if (!grouped[weekKey]) {
        grouped[weekKey] = {
          weekStart,
          lessons: []
        };
      }
      grouped[weekKey].lessons.push(lesson);
    });
    return Object.values(grouped).sort((a, b) => a.weekStart - b.weekStart);
  };

  const groupedLessons = groupLessonsByWeek(lessons);
  console.log('Grouped Lessons:', groupedLessons);

  const handleCancel = async (lessonId) => {
    if (!window.confirm('Are you sure you want to cancel this lesson?')) return;
    try {
      await deleteDoc(doc(db, 'bookings', lessonId));
      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch (error) {
      alert('Failed to cancel lesson.');
    }
  };

  const isTutor = currentUser && TUTOR_EMAILS.includes(currentUser.email);

  const handleGenerateMeetLink = async (lesson) => {
    try {
      const res = await fetch('https://calendar-backend-tejy.onrender.com/api/generate-meet-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lesson })
      });
      if (res.ok) {
        const data = await res.json();
        // Update Firestore with new meetLink
        await updateDoc(doc(db, 'bookings', lesson.id), { meetLink: data.meetLink, eventLink: data.eventLink });
        setLessons(lessons => lessons.map(l => l.id === lesson.id ? { ...l, meetLink: data.meetLink, eventLink: data.eventLink } : l));
        alert('Google Meet link generated and saved!');
      } else {
        alert('Failed to generate Meet link.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Helper to calculate end time string
  function getEndTime(startTime) {
    // startTime is like '2:30 PM'
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

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Not logged in</h3>
        <p className="text-gray-600">Please log in to view your lessons.</p>
      </div>
    );
  }

  if (!loading && lessons.length === 0 && tutorMode) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No lessons scheduled</h3>
        <p className="text-gray-600">(Filtering for tutor: {tutorName})</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-2 sm:mt-6 px-1 sm:px-4">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-gray-900 text-center">My Lessons</h2>
      <div>
        {groupedLessons.map((weekGroup, idx) => (
          <div key={idx} className="w-full my-8 sm:my-12 bg-blue-50 border border-blue-200 rounded-2xl shadow-lg px-2 sm:px-6 py-6 sm:py-8">
            <h3 className="text-xl sm:text-2xl font-bold text-blue-900 mb-6 sm:mb-8 text-center tracking-tight pb-2 sm:pb-4 border-b border-blue-200">
              Week of {format(weekGroup.weekStart, 'MMMM d')}
            </h3>
            <div className="flex flex-col items-center gap-8">
              {weekGroup.lessons
                .slice()
                .sort((a, b) => {
                  const dateA = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date);
                  const dateB = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date);
                  return dateA - dateB;
                })
                .map(lesson => (
                  <div key={lesson.id} className="bg-white rounded-2xl shadow p-2 sm:p-6 flex flex-col min-h-[200px] sm:min-h-[220px] w-full max-w-2xl mx-auto">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <span className="text-lg sm:text-xl font-bold text-blue-900 break-words leading-snug">{lesson.course}</span>
                      {tutorMode ? (
                        <button
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm ml-2 px-3 py-1 rounded shadow focus:outline-none focus:ring-2 focus:ring-green-400"
                          onClick={() => handleCancel(lesson.id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Done
                        </button>
                      ) : (
                        <button
                          className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm ml-2 px-3 py-1 rounded shadow focus:outline-none focus:ring-2 focus:ring-red-400"
                          onClick={() => handleCancel(lesson.id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancel
                        </button>
                      )}
                    </div>
                    {tutorMode ? (
                      <span className="block text-gray-700 text-lg sm:text-xl font-bold mb-2">with <span className="text-black font-extrabold">{lesson.child}</span></span>
                    ) : (
                      <span className="block text-gray-700 text-base sm:text-lg font-medium mb-2">with <span className="font-bold text-black">{lesson.tutor}</span></span>
                    )}
                    <div className="flex items-center gap-2 text-gray-700 mb-1 mt-2">
                      <FaCalendarAlt className="text-base sm:text-lg" />
                      <span className="text-sm sm:text-base">{format(new Date(lesson.date), 'EEEE, MMMM d')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 mb-1">
                      <FaClock className="text-base sm:text-lg" />
                      <span className="text-sm sm:text-base">{lesson.time} - {getEndTime(lesson.time)}</span>
                    </div>
                    {!tutorMode && (
                      <div className="flex items-center gap-2 text-gray-700 mt-2">
                        <FaUser className="text-base sm:text-lg" />
                        <span className="text-sm sm:text-base">{lesson.child} (Grade {lesson.grade})</span>
                      </div>
                    )}
                    {lesson.meetLink && (
                      <>
                        <div className="mt-3">
                          <a
                            href={lesson.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3 rounded-lg shadow transition-all text-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-9A2.25 2.25 0 002.25 5.25v13.5A2.25 2.25 0 004.5 21h9a2.25 2.25 0 002.25-2.25V15M18 15l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            Join Google Meet
                          </a>
                        </div>
                      </>
                    )}
                    {!lesson.meetLink && tutorMode && (
                      <TutorMeetLinkInput lesson={lesson} setLessons={setLessons} />
                    )}
                    {!lesson.meetLink && !tutorMode && (
                      <div className="mt-3 text-gray-600 text-center font-medium">
                        The tutor will update this link before the session.
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TutorMeetLinkInput({ lesson, setLessons }) {
  const [meetLink, setMeetLink] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const handleSave = async () => {
    if (!meetLink) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'bookings', lesson.id), { meetLink });
      setLessons(lessons => lessons.map(l => l.id === lesson.id ? { ...l, meetLink } : l));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      alert('Failed to save Meet link.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <input
        type="text"
        className="border rounded px-3 py-2"
        placeholder="Paste Google Meet link here"
        value={meetLink}
        onChange={e => setMeetLink(e.target.value)}
        disabled={saving}
      />
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded shadow disabled:opacity-50"
        onClick={handleSave}
        disabled={saving || !meetLink}
      >
        {saving ? 'Saving...' : 'Save Link'}
      </button>
      {success && <span className="text-green-600 text-sm">Link saved!</span>}
    </div>
  );
} 