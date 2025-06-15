import React, { useState } from 'react';
import { auth, db } from '../utils/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { packages } from '../data/packages';

export default function AuthForm({ onAuth }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [childName, setChildName] = useState('');
  const [packageId, setPackageId] = useState('');
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignUp) {
      if (!email || !password || !childName || !packageId) {
        setError('All fields are required.');
        return;
      }
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email,
          childName,
          packageId,
          verified: false,
        });
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
              placeholder="Child Name"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              className="w-full p-3 rounded-md border border-blue-200 bg-white"
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
          </>
        )}
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
        >
          {isSignUp ? 'Sign Up' : 'Login'}
        </button>
      </form>
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