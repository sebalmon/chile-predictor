import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = cargando
  const [userProfile, setUserProfile] = useState(null); // datos de Firestore
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setLoadingProfile(true);
        try {
          const ref = doc(db, "usuarios", user.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            setUserProfile(snap.data());
          } else {
            setUserProfile(null); // Nuevo usuario → va a Registro
          }
        } catch (e) {
          console.error("Error cargando perfil:", e);
          setUserProfile(null);
        } finally {
          setLoadingProfile(false);
        }
      } else {
        setUserProfile(null);
        setLoadingProfile(false);
      }
    });
    return unsub;
  }, []);

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    const ref = doc(db, "usuarios", firebaseUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) setUserProfile(snap.data());
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, userProfile, setUserProfile, loadingProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
