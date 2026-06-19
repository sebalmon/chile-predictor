// src/contexts/MusicaContext.jsx  — v1 (Patch 2)
// ─────────────────────────────────────────────────────────────
// Contexto global de música ambiental.
// • Lee config/sonidoDia de Firestore al montar.
// • Reproduce el archivo en bucle con fade-in en TODA la app.
// • Respeta la preferencia del usuario (localStorage).
// • Expone { musicaOn, toggleMusica } al resto de la app.
// • Se monta UNA SOLA VEZ en App.jsx (no en cada pestaña).
// ─────────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const LS_KEY = "cp8b_musica_activada";

const MusicaCtx = createContext({ musicaOn: false, toggleMusica: () => {} });
export const useMusica = () => useContext(MusicaCtx);

export function MusicaProvider({ children }) {
  const [musicaOn, setMusicaOn] = useState(
    () => localStorage.getItem(LS_KEY) !== "0"
  );
  const [config, setConfig] = useState(null); // { archivo, volumen }
  const audioRef = useRef(null);
  const fadeRef  = useRef(null);

  // Cargar configuración desde Firestore una vez
  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "sonidoDia"));
        if (snap.exists() && snap.data().archivo) {
          setConfig({
            archivo: snap.data().archivo,
            volumen: snap.data().volumen ?? 0.35,
          });
        }
      } catch (_) {}
    };
    cargar();
  }, []);

  // Crear/destruir el elemento Audio cuando cambia el archivo
  useEffect(() => {
    if (!config?.archivo) return;

    const audio = new Audio(`/sounds/${config.archivo}`);
    audio.loop   = true;
    audio.volume = 0;
    audioRef.current = audio;

    if (musicaOn) {
      audio.play().catch(() => {});
      _fadeIn(audio, config.volumen);
    }

    return () => {
      clearInterval(fadeRef.current);
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Reaccionar a cambios de musicaOn
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !config) return;
    clearInterval(fadeRef.current);
    if (musicaOn) {
      audio.play().catch(() => {});
      _fadeIn(audio, config.volumen);
    } else {
      _fadeOut(audio);
    }
  }, [musicaOn, config]);

  function _fadeIn(audio, target) {
    clearInterval(fadeRef.current);
    const t = Math.min(1, Math.max(0, Number(target)));
    fadeRef.current = setInterval(() => {
      if (!audioRef.current) { clearInterval(fadeRef.current); return; }
      const next = Math.min(t, audio.volume + 0.02);
      audio.volume = next;
      if (next >= t) clearInterval(fadeRef.current);
    }, 80);
  }

  function _fadeOut(audio) {
    clearInterval(fadeRef.current);
    fadeRef.current = setInterval(() => {
      if (!audioRef.current) { clearInterval(fadeRef.current); return; }
      const next = Math.max(0, audio.volume - 0.03);
      audio.volume = next;
      if (next <= 0) {
        audio.pause();
        clearInterval(fadeRef.current);
      }
    }, 60);
  }

  const toggleMusica = () => {
    setMusicaOn(v => {
      const nuevo = !v;
      localStorage.setItem(LS_KEY, nuevo ? "1" : "0");
      return nuevo;
    });
  };

  return (
    <MusicaCtx.Provider value={{ musicaOn, toggleMusica }}>
      {children}
    </MusicaCtx.Provider>
  );
}
