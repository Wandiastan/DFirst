import { initializeApp } from 'firebase/app';
import { 
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyANrQLUcbyk2D1o0M3ByASBxwzN2i9Ha80",
  authDomain: "dfirst-trader.firebaseapp.com",
  projectId: "dfirst-trader",
  storageBucket: "dfirst-trader.firebasestorage.app",
  messagingSenderId: "294986926650",
  appId: "1:294986926650:android:ca22c6d05991c97d5c0303"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Email validation helper
const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Auth functions
export const loginWithEmail = async (email: string, password: string) => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    throw new Error('Email and password are required');
  }
  if (!isValidEmail(trimmedEmail)) {
    throw new Error('Please enter a valid email address');
  }
  return signInWithEmailAndPassword(auth, trimmedEmail, password);
};

export const createAccount = async (email: string, password: string, name: string) => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password || !name) {
    throw new Error('All fields are required');
  }
  if (!isValidEmail(trimmedEmail)) {
    throw new Error('Please enter a valid email address');
  }
  if (password.length < 6) {
    throw new Error('Password should be at least 6 characters');
  }
  const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
  if (userCredential.user) {
    await updateProfile(userCredential.user, { displayName: name });
  }
  return userCredential;
};

export const logout = () => signOut(auth);

export const onAuthChanged = (callback: (user: User | null) => void) => 
  onAuthStateChanged(auth, callback);

export const getCurrentUser = () => auth.currentUser;

const firebaseAuth = {
  auth,
  loginWithEmail,
  createAccount,
  logout,
  onAuthChanged,
  getCurrentUser
};

export default firebaseAuth; 