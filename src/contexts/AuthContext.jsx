// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
        if (userDoc.exists()) {
          let data = userDoc.data();
          // Convertir antiguo array cartasDesbloqueadas a nuevo objeto cartas si existe
          if (data.cartasDesbloqueadas && !data.cartas) {
            const cartasObj = {};
            data.cartasDesbloqueadas.forEach(cartaId => {
              cartasObj[cartaId] = (cartasObj[cartaId] || 0) + 1;
            });
            data.cartas = cartasObj;
          }
          setUserProfile(data);
        } else {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoadingProfile(false);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (firebaseUser) {
      const userDoc = await getDoc(doc(db, "usuarios", firebaseUser.uid));
      if (userDoc.exists()) {
        let data = userDoc.data();
        if (data.cartasDesbloqueadas && !data.cartas) {
          const cartasObj = {};
          data.cartasDesbloqueadas.forEach(cartaId => {
            cartasObj[cartaId] = (cartasObj[cartaId] || 0) + 1;
          });
          data.cartas = cartasObj;
        }
        setUserProfile(data);
      }
    }
  };

  const value = {
    firebaseUser,
    userProfile,
    setUserProfile,
    loadingProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}