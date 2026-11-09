
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId &&
  firebaseConfig.messagingSenderId
);

const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

// Servicios Firebase
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Google Analytics
export async function getFirebaseAnalytics() {
  if (
    typeof window === "undefined" ||
    !app ||
    !firebaseConfig.measurementId
  ) {
    return null;
  }

  const { isSupported, getAnalytics } = await import("firebase/analytics");

  if (!(await isSupported())) {
    return null;
  }

  return getAnalytics(app);
}

export async function trackEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {}
) {
  if (
    typeof window === "undefined" ||
    window.localStorage.getItem("analyticsConsent") !== "accepted"
  ) {
    return;
  }

  try {
    const analytics = await getFirebaseAnalytics();

    if (!analytics) return;

    const { logEvent } = await import("firebase/analytics");
    logEvent(analytics, eventName, params);
  } catch (error) {
    console.warn("No se pudo registrar el evento de Analytics:", error);
  }
}
