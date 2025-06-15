import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../utils/AuthContext';

export default function Settings() {
  const [children, setChildren] = useState([]);
  const [newChild, setNewChild] = useState({ name: '', grade: '' });
  const [editingChild, setEditingChild] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchChildren();
    }
  }, [currentUser]);

  const fetchChildren = async () => {
    try {
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
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'children'), {
        name: newChild.name,
        grade: newChild.grade,
        userId: currentUser.uid,
        createdAt: new Date()
      });
      setNewChild({ name: '', grade: '' });
      fetchChildren();
    } catch (error) {
      console.error('Error adding child:', error);
    }
  };

  const handleDeleteChild = async (childId) => {
    try {
      await deleteDoc(doc(db, 'children', childId));
      fetchChildren();
    } catch (error) {
      console.error('Error deleting child:', error);
    }
  };

  const handleEditChild = async (e) => {
    e.preventDefault();
    try {
      // Get the previous name before updating
      const prevChild = children.find(c => c.id === editingChild.id);
      const prevName = prevChild ? prevChild.name : '';
      await updateDoc(doc(db, 'children', editingChild.id), {
        name: editingChild.name,
        grade: editingChild.grade
      });
      // Update all bookings for this child with the new name
      if (prevName && prevName !== editingChild.name) {
        const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('child', '==', prevName)));
        for (const bookingDoc of bookingsSnap.docs) {
          await updateDoc(bookingDoc.ref, { child: editingChild.name });
        }
      }
      setEditingChild(null);
      fetchChildren();
    } catch (error) {
      console.error('Error updating child:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Child Management</h2>
      
      {/* Add New Child Form */}
      <form onSubmit={handleAddChild} className="mb-8 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Add New Child</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={newChild.name}
              onChange={(e) => setNewChild({ ...newChild, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-2 border-blue-400 bg-blue-50 shadow-sm focus:border-blue-600 focus:ring-blue-600 text-lg p-3"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Grade</label>
            <input
              type="text"
              value={newChild.grade}
              onChange={(e) => setNewChild({ ...newChild, grade: e.target.value })}
              className="mt-1 block w-full rounded-md border-2 border-blue-400 bg-blue-50 shadow-sm focus:border-blue-600 focus:ring-blue-600 text-lg p-3"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Add Child
        </button>
      </form>

      {/* Children List */}
      <div className="bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold p-6 border-b">Your Children</h3>
        <div className="divide-y">
          {children.map((child) => (
            <div key={child.id} className="p-6">
              {editingChild?.id === child.id ? (
                <form onSubmit={handleEditChild} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="text"
                      value={editingChild.name}
                      onChange={(e) => setEditingChild({ ...editingChild, name: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={editingChild.grade}
                      onChange={(e) => setEditingChild({ ...editingChild, grade: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingChild(null)}
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{child.name}</h4>
                    <p className="text-gray-600">Grade {child.grade}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingChild(child)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteChild(child.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {children.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No children added yet. Add your first child above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 