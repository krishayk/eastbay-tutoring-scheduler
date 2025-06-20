import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../utils/AuthContext';
import { format, startOfWeek, parseISO, isBefore } from 'date-fns';
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
  const [editingMeetLinkId, setEditingMeetLinkId] = useState(null);
  const [editingMeetLinkValue, setEditingMeetLinkValue] = useState("");
  const [meetLinkEditError, setMeetLinkEditError] = useState("");

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
          // Fetch all bookings, then filter for tutor or busyTutor
          q = query(collection(db, 'bookings'), orderBy('date', 'asc'));
          const querySnapshot = await getDocs(q);
          const lessonsList = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(lesson =>
              (lesson.tutor && lesson.tutor.toLowerCase() === tutorName.toLowerCase()) ||
              (lesson.busyTutor && lesson.busyTutor.toLowerCase() === tutorName.toLowerCase())
            );
          setLessons(lessonsList);
          setLoading(false);
          return;
        } else {
          // Regular user: show their own lessons
          q = query(collection(db, 'bookings'), where('userId', '==', currentUser.uid), orderBy('date', 'asc'));
        }
        const querySnapshot = await getDocs(q);
        const lessonsData = await Promise.all(
          querySnapshot.docs.map(async (bookingDoc) => {
            const booking = { id: bookingDoc.id, ...bookingDoc.data() };
            let tutorInfo = { id: '', name: booking.tutor || 'Unknown Tutor', email: 'No email available' };
            if (booking.tutorId) {
              const tutorRef = doc(db, 'users', booking.tutorId);
              const tutorDoc = await getDoc(tutorRef);
              const tutorData = tutorDoc.data();
              tutorInfo = {
                id: booking.tutorId,
                name: tutorData?.name || booking.tutor || 'Unknown Tutor',
                email: tutorData?.email || 'No email available'
              };
            }
            return {
              ...booking,
              tutor: tutorInfo
            };
          })
        );
        // Sort lessons by date and time
        const sortedLessons = lessonsData.sort((a, b) => {
          const dateA = parseISO(a.date);
          const dateB = parseISO(b.date);
          return dateA - dateB;
        });
        setLessons(sortedLessons);
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

  const handleSaveMeetLink = async (lessonId) => {
    if (!editingMeetLinkValue.trim()) {
      setMeetLinkEditError("Meet link cannot be empty.");
      return;
    }
    try {
      await updateDoc(doc(db, 'bookings', lessonId), { meetLink: editingMeetLinkValue });
      setLessons(lessons => lessons.map(l => l.id === lessonId ? { ...l, meetLink: editingMeetLinkValue } : l));
      setEditingMeetLinkId(null);
      setEditingMeetLinkValue("");
      setMeetLinkEditError("");
    } catch (err) {
      alert('Failed to save Meet link.');
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

  // Debug tutorMode and tutorName
  console.log('tutorMode:', tutorMode);
  console.log('tutorName:', tutorName);
  console.log('All lessons:', lessons);

  // Filter lessons for tutors: show sessions where they are the assigned tutor OR the busyTutor
  const filteredLessons = tutorMode
    ? lessons.filter(
        (lesson) => lesson.tutor === tutorName || lesson.busyTutor === tutorName
      )
    : lessons;
  console.log('Filtered lessons:', filteredLessons);

  // Debug logs for lessons and tutor
  console.log('All lessons:', lessons);
  console.log('Tutor name:', tutorName);
  const busyLessons = lessons.filter(lesson => lesson.busyTutor === tutorName);
  console.log('Lessons where tutor is busyTutor:', busyLessons);

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

  if (filteredLessons.length === 0) {
    return (
      <div className="text-gray-500 text-center">No lessons found.</div>
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
                .map(lesson => {
                  // For tutors: is this a substituted session?
                  const isSubstituted = tutorMode && lesson.busyTutor && lesson.busyTutor.toLowerCase() === tutorName?.toLowerCase() && lesson.tutor.name.toLowerCase() !== tutorName?.toLowerCase();
                  const needsReschedule = lesson.needsReschedule;
                  return (
                    <div
                      key={lesson.id}
                      className={`bg-white rounded-2xl shadow p-2 sm:p-6 flex flex-col min-h-[200px] sm:min-h-[220px] w-full max-w-2xl mx-auto ${isSubstituted ? 'opacity-60 border-2 border-yellow-400' : ''} ${needsReschedule ? 'border-2 border-red-500 bg-red-50' : ''}`}
                    >
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
                      {/* Show student name only for tutors, otherwise show tutor (with busy/substitute logic) */}
                      <span className={tutorMode ? "block text-gray-700 text-lg sm:text-xl font-bold mb-2" : "block text-gray-700 text-base sm:text-lg font-medium mb-2"}>
                        with <span className="font-bold text-black">
                          {tutorMode
                            ? lesson.child
                            : lesson.busyTutor
                              ? (<><span className="line-through text-red-600">{lesson.busyTutor}</span> <span className="text-red-600 font-semibold">(Busy)</span> <span className="text-gray-500">→</span> {lesson.tutor.name}</>)
                              : lesson.tutor.name}
                          {/* Substitute badge for substitute tutor */}
                          {tutorMode && lesson.busyTutor && (
                            <span className="ml-2 px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded font-semibold">Substituted by {lesson.tutor.name}</span>
                          )}
                        </span>
                      </span>
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
                      {tutorMode ? (
                        lesson.meetLink && lesson.meetLink.trim() !== "" ? (
                          editingMeetLinkId === lesson.id ? (
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                type="text"
                                className="border rounded px-3 py-2 w-64"
                                value={editingMeetLinkValue}
                                onChange={e => setEditingMeetLinkValue(e.target.value)}
                              />
                              {meetLinkEditError && (
                                <span className="text-red-600 text-xs ml-2">{meetLinkEditError}</span>
                              )}
                              <button
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1 rounded"
                                onClick={() => handleSaveMeetLink(lesson.id)}
                              >Save</button>
                              <button
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold px-3 py-1 rounded"
                                onClick={() => { setEditingMeetLinkId(null); setEditingMeetLinkValue(""); }}
                              >Cancel</button>
                            </div>
                          ) : (
                            <div className="mt-3 flex items-center gap-2">
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
                              <button
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-3 py-1 rounded shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
                                onClick={() => { setEditingMeetLinkId(lesson.id); setEditingMeetLinkValue(lesson.meetLink); }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l10.607-10.607z" />
                                </svg>
                                Edit
                              </button>
                            </div>
                          )
                        ) : (
                          <TutorMeetLinkInput lesson={lesson} setLessons={setLessons} />
                        )
                      ) : (
                        <div className="mt-3 flex items-center gap-2">
                          {lesson.meetLink && lesson.meetLink.trim() !== "" ? (
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
                          ) : (
                            <div className="text-gray-600 text-center font-medium">
                              The tutor will update this link before the session.
                            </div>
                          )}
                        </div>
                      )}
                      {needsReschedule && (
                        <div className="mt-3 flex flex-col items-center">
                          <span className="text-red-600 font-semibold mb-2">This session needs to be rescheduled due to tutor unavailability.</span>
                          <button
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded shadow"
                            onClick={() => alert('Reschedule flow coming soon!')}
                          >
                            Reschedule
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
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