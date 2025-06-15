import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../utils/AuthContext';
import { format, startOfWeek } from 'date-fns';
import { FaCalendarAlt, FaClock, FaUser } from 'react-icons/fa';

console.log('🔥🔥🔥 MyLessons component is mounted! 🔥🔥🔥');

export default function MyLessons() {
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
        const q = query(
          collection(db, 'bookings'),
          where('userId', '==', currentUser.uid),
          orderBy('date', 'asc')
        );
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
  }, [currentUser]);

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

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Not logged in</h3>
        <p className="text-gray-600">Please log in to view your lessons.</p>
      </div>
    );
  }

  if (!loading && lessons.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No lessons scheduled</h3>
        <p className="text-gray-600">Book your first lesson to get started!</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-6 px-2 sm:px-4">
      <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-gray-900 text-center">My Lessons</h2>
      <div>
        {groupedLessons.map((weekGroup, idx) => (
          <div key={idx} className="w-full my-8 sm:my-12 bg-blue-50 border border-blue-200 rounded-2xl shadow-lg px-2 sm:px-6 py-6 sm:py-8">
            <h3 className="text-xl sm:text-2xl font-bold text-blue-900 mb-6 sm:mb-8 text-center tracking-tight pb-2 sm:pb-4 border-b border-blue-200">
              Week of {format(weekGroup.weekStart, 'MMMM d')}
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
              {weekGroup.lessons
                .slice()
                .sort((a, b) => {
                  const dateA = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date);
                  const dateB = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date);
                  return dateA - dateB;
                })
                .map(lesson => (
                  <div key={lesson.id} className="bg-white rounded-2xl shadow p-4 sm:p-6 flex flex-col min-h-[200px] sm:min-h-[220px]">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <span className="text-lg sm:text-xl font-bold text-blue-900 break-words leading-snug">{lesson.course}</span>
                      <button
                        className="text-red-600 font-semibold hover:underline text-xs sm:text-sm ml-2 px-2 py-1 rounded transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-400"
                        onClick={() => handleCancel(lesson.id)}
                      >
                        Cancel
                      </button>
                    </div>
                    {lesson.tutor && (
                      <span className="block text-gray-700 text-sm sm:text-base font-medium mb-2">with {lesson.tutor}</span>
                    )}
                    <div className="flex items-center gap-2 text-gray-700 mb-1 mt-2">
                      <FaCalendarAlt className="text-base sm:text-lg" />
                      <span className="text-sm sm:text-base">{format(new Date(lesson.date), 'EEEE, MMMM d')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 mb-1">
                      <FaClock className="text-base sm:text-lg" />
                      <span className="text-sm sm:text-base">{lesson.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700 mt-2">
                      <FaUser className="text-base sm:text-lg" />
                      <span className="text-sm sm:text-base">{lesson.child} (Grade {lesson.grade})</span>
                    </div>
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
                        <div className="mt-2 text-xs text-gray-500">You will not see this event in your own Google Calendar, but you can join the session using the Meet link below.</div>
                      </>
                    )}
                    {!lesson.meetLink && (
                      <div className="mt-2 text-gray-400 text-xs">No Google Meet link available for this lesson.</div>
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