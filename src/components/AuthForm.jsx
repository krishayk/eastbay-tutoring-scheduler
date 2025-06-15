import React, { useState } from 'react';
import { auth, db } from '../utils/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { packages } from '../data/packages';

export default function AuthForm({ onAuth }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [children, setChildren] = useState([{ name: '', grade: '' }]);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignUp) {
      if (!email || !password || !parentName || !parentPhone || !packageId) {
        setError('All fields are required.');
        return;
      }
      // Validate children
      for (const child of children) {
        if (!child.name || !child.grade) {
          setError('Please enter a name and grade for each child.');
          return;
        }
      }
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email,
          parentName,
          parentPhone,
          packageId,
          verified: false,
        });
        // Add children to Firestore
        for (const child of children) {
          await addDoc(collection(db, 'children'), {
            name: child.name,
            grade: child.grade,
            userId: userCred.user.uid,
            createdAt: new Date()
          });
        }
        setShowPayment(true);
        onAuth(userCred.user);
      } catch (err) {
        setError(err.message);
      }
    } else {
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
        if (!userDoc.exists()) {
          setError('User profile not found. Please sign up.');
          return;
        }
        onAuth(userCred.user);
      } catch (err) {
        setError('Invalid email or password.');
      }
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetMessage('');
    if (!resetEmail) {
      setResetMessage('Please enter your email.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Password reset email sent! Check your inbox.');
    } catch (err) {
      setResetMessage('Error: ' + err.message);
    }
  };

  if (showPayment && isSignUp) {
    const selected = packages.find(p => p.id === packageId);
    return (
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 mt-10 text-center">
        <h2 className="text-2xl font-bold mb-4">Almost done!</h2>
        <p className="mb-4">Please Zelle the package fee to <span className="font-bold">9258758136</span>.<br />
        <span className="font-bold">Include your account email and child name in the note.</span></p>
        <div className="bg-blue-100 rounded p-4 mb-4">
          <div className="font-semibold">Selected Package:</div>
          <div className="font-bold">{selected.name}</div>
          <div>${selected.price}/week</div>
          <div className="text-xs mt-2">{selected.description}</div>
        </div>
        <div className="text-green-700 font-semibold">Once payment is received, an admin will verify your account and you can start booking sessions.</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8 mt-10">
      <h2 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h2>
      {showReset ? (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
          >
            Send Password Reset Email
          </button>
          {resetMessage && <div className="text-center text-sm mt-2 text-blue-700">{resetMessage}</div>}
          <div className="mt-4 text-center">
            <button type="button" className="text-blue-600 underline" onClick={() => setShowReset(false)}>
              Back to Login
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full p-3 rounded-md border border-blue-200 bg-white"
          />
          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Parent Name"
                value={parentName}
                onChange={e => setParentName(e.target.value)}
                className="w-full p-3 rounded-md border-2 border-blue-400 bg-blue-50 text-lg"
                required
              />
              <input
                type="tel"
                placeholder="Parent Phone Number"
                value={parentPhone}
                onChange={e => setParentPhone(e.target.value)}
                className="w-full p-3 rounded-md border-2 border-blue-400 bg-blue-50 text-lg"
                required
              />
              <select
                value={packageId}
                onChange={e => setPackageId(e.target.value)}
                className="w-full p-3 rounded-md border border-blue-200 bg-white"
              >
                <option value="">Select a Package</option>
                {packages.map(pkg => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} - ${pkg.price}/week</option>
                ))}
              </select>
              <div className="bg-blue-50 rounded-lg p-4 mt-2">
                <h3 className="font-semibold mb-2">Child Information</h3>
                {children.map((child, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Child Name"
                      value={child.name}
                      onChange={e => {
                        const updated = [...children];
                        updated[idx].name = e.target.value;
                        setChildren(updated);
                      }}
                      className="flex-1 p-2 rounded border border-blue-200"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Grade"
                      value={child.grade}
                      onChange={e => {
                        const updated = [...children];
                        updated[idx].grade = e.target.value;
                        setChildren(updated);
                      }}
                      className="w-24 p-2 rounded border border-blue-200"
                      required
                    />
                    {children.length > 1 && (
                      <button
                        type="button"
                        className="text-red-500 font-bold px-2"
                        onClick={() => setChildren(children.filter((_, i) => i !== idx))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => setChildren([...children, { name: '', grade: '' }])}
                >
                  Add Another Child
                </button>
              </div>
            </>
          )}
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
          >
            {isSignUp ? 'Sign Up' : 'Login'}
          </button>
          {!isSignUp && (
            <div className="mt-2 text-center">
              <button type="button" className="text-blue-600 underline" onClick={() => setShowReset(true)}>
                Forgot your password?
              </button>
            </div>
          )}
        </form>
      )}
      <div className="mt-4 text-center">
        {isSignUp ? (
          <span>Already have an account? <button className="text-blue-600 underline" onClick={() => setIsSignUp(false)}>Login</button></span>
        ) : (
          <span>Don&apos;t have an account? <button className="text-blue-600 underline" onClick={() => setIsSignUp(true)}>Sign Up</button></span>
        )}
      </div>
    </div>
  );
} 