"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import Countdown from "@/app/components/Countdown";
import { subscribeWhisper, getWhisperState } from "@/lib/globalWhisperState";
import useAssessment from "@/hooks/useAssessment";
import { encodeWAV, downsampleBuffer } from "@/lib/wavEncoder";

const FeatureComputer = forwardRef(function FeatureComputer({ onStatus }, ref) {
  const { file, setFile, setRefTopic, setModel, setTranscript, run, result, status } = useAssessment();
  const resolverRef = useRef(null);
  const onStatusRef = useRef(onStatus);
  const pendingStartRef = useRef(null);

  useEffect(() => {
    if (result && resolverRef.current) {
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve(result);
    }
  }, [result]);

  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
  useEffect(() => {
    if (typeof onStatusRef.current === "function") onStatusRef.current(status || "");
  }, [status]);

  useEffect(() => {
    const pending = pendingStartRef.current;
    if (pending && pending.file && file === pending.file) {
      try { run(); } finally { pendingStartRef.current = null; }
    }
  }, [file, run]);

  useImperativeHandle(ref, () => ({
    async compute(file, refTopic = "") {
      return new Promise(async (resolve) => {
        resolverRef.current = resolve;
        pendingStartRef.current = { file, refTopic };
        try {
          setModel("whisper");
          setTranscript("");
        } catch (_) {}
        setRefTopic(refTopic);
        setFile(file);
      });
    }
  }));
  return null;
});

function useMediaRecorder() {
  const mediaRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const pcmDataRef = useRef([]);
  
  const [supported, setSupported] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [chunks, setChunks] = useState([]); // chunks akan berisi [wavBlob]

  const canUseMedia = useCallback(() => (
    typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === "function"
  ), []);

  useEffect(() => {
    setSupported(canUseMedia());
  }, [canUseMedia]);

  const requestPermission = useCallback(async () => {
    try {
      if (!canUseMedia()) {
        setPermissionError("Mic not supported in this browser");
        setSupported(false);
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionError("");
      setSupported(true);
      return true;
    } catch (e) {
      console.error(e);
      setPermissionError(e?.message || String(e));
      return false;
    }
  }, [canUseMedia]);

  const start = useCallback(async () => {
    try {
      if (!canUseMedia()) {
        setPermissionError("Mic not supported in this browser");
        setSupported(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);

      pcmDataRef.current = [];
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Copy samples to ref
        const chunk = new Float32Array(inputData.length);
        chunk.set(inputData);
        pcmDataRef.current.push(chunk);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      audioCtxRef.current = audioCtx;
      processorRef.current = processor;
      mediaRef.current = stream;
      
      setChunks([]);
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setPermissionError(e?.message || String(e));
    }
  }, [canUseMedia]);

  const stop = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const processor = processorRef.current;
    const stream = mediaRef.current;

    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }
    if (audioCtx) {
      audioCtx.close();
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    // Combine chunks and encode to WAV
    const pcmData = pcmDataRef.current;
    if (pcmData.length > 0) {
      // Flatten all Float32Arrays
      let totalLength = 0;
      for (const arr of pcmData) totalLength += arr.length;
      const flat = new Float32Array(totalLength);
      let offset = 0;
      for (const arr of pcmData) {
        flat.set(arr, offset);
        offset += arr.length;
      }

      // Encode to 16kHz WAV
      const wavBlob = encodeWAV(flat, 16000);
      setChunks([wavBlob]);
    }

    setIsRecording(false);
    audioCtxRef.current = null;
    processorRef.current = null;
    mediaRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setChunks([]);
    pcmDataRef.current = [];
  }, []);

  return { supported, permissionError, isRecording, chunks, start, stop, reset, requestPermission };
}

export default function AssessmentFlow() {
  // Alur Langkah: -1 = Autentikasi Google, 0 = Form Biodata, 1..6 = Tugas Asesmen, 7 = Ringkasan Hasil
  const [step, setStep] = useState(-1); 
  const [consentSlide, setConsentSlide] = useState(1); // 1..8 = Instruksi, 9 = E-Consent, 10 = Form Biodata
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [c4, setC4] = useState(false);
  const [c5, setC5] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Kredensial Google Simulation & Akun
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  // State Biodata Mahasiswa
  const [nama, setNama] = useState("");
  const [prodi, setProdi] = useState("");
  const [umur, setUmur] = useState(18);
  const [jk, setJk] = useState("");
  const [kota, setKota] = useState("");
  const [domisiliSekarang, setDomisiliSekarang] = useState("");
  const [asalKampus, setAsalKampus] = useState("");
  const [jenisTes, setJenisTes] = useState("");
  const [skorTes, setSkorTes] = useState("0");
  const [persepsi, setPersepsi] = useState("");
  const [mahasiswa, setMahasiswa] = useState(null);

  // Data Tugas & Rekaman
  const [currentTugas, setCurrentTugas] = useState(null);
  const [imageForTask4, setImageForTask4] = useState(null);
  const [prepLeft, setPrepLeft] = useState(0);
  const [recLeft, setRecLeft] = useState(0);
  const [recordReady, setRecordReady] = useState(false);
  const [uploaded, setUploaded] = useState([]); // [{ tugas, rekaman, file, refTopic, analisis }]

  const { supported, permissionError, isRecording, chunks, start, stop, reset, requestPermission } = useMediaRecorder();
  const featureRef = useRef(null);
  const lastStartedTaskIdRef = useRef(null);

  // URL Backend Server Terpusat ditiadakan untuk mode 100% Vercel Cloud-Native

  // Pre-fill akun percobaan untuk mempermudah demonstrasi
  useEffect(() => {
    setGoogleEmail("rizal@itenas.ac.id");
    setGoogleName("Rizal");
  }, []);

  // 1. Logika Login Google (Pemeriksaan Akun Returning User via Firebase Firestore)
  const onGoogleSignIn = useCallback(async (e) => {
    e?.preventDefault();
    if (!googleEmail || !googleName) {
      setError("Masukkan Email dan Nama Akun Google Anda.");
      return;
    }
    setError("");
    setLoading(true);
    setAuthMsg("Memverifikasi kredensial akun di Firebase Firestore...");
    try {
      const res = await fetch(`/api/mahasiswa?email=${encodeURIComponent(googleEmail)}`);
      
      if (!res.ok) {
        throw new Error("Gagal menghubungi layanan database awan Firebase.");
      }
      
      const j = await res.json();
      setMahasiswa(j?.mahasiswa || { id: googleEmail, email: googleEmail, nama: googleName });
      setNama(j?.mahasiswa?.nama || googleName);
      setProdi(j?.mahasiswa?.program_studi || "");
      setUmur(j?.mahasiswa?.umur || 18);
      setJk(j?.mahasiswa?.jenis_kelamin || "");
      setKota(j?.mahasiswa?.kota_asal || "");
      setDomisiliSekarang(j?.mahasiswa?.domisili_sekarang || "");
      setAsalKampus(j?.mahasiswa?.asal_kampus || "");
      setJenisTes(j?.mahasiswa?.jenis_tes || "");
      setSkorTes(j?.mahasiswa?.skor_tes || "0");
      setPersepsi(j?.mahasiswa?.persepsi || "");
      
      // Logika Alur Bersyarat: Returning User Langsung ke Tes
      if (j?.is_registered) {
        setAuthMsg("Selamat datang kembali! Biodata lengkap terdeteksi. Langsung mengarahkan ke Asesmen...");
        setTimeout(() => {
          setStep(1); // Melompati form biodata
          setLoading(false);
          setAuthMsg("");
        }, 1200);
      } else {
        setAuthMsg("Akun baru terdeteksi. Mengarahkan ke pelengkapan biodata...");
        setTimeout(() => {
          setStep(0); // Menampilkan form biodata
          setLoading(false);
          setAuthMsg("");
        }, 1200);
      }
    } catch (err) {
      setError(err?.message || String(err));
      setLoading(false);
      setAuthMsg("");
    }
  }, [googleEmail, googleName]);

  // 2. Logika Submisi Form Biodata ke Firebase Firestore
  const onSubmitMahasiswa = useCallback(async (e) => {
    e.preventDefault();
    if (!jk || !jenisTes || !persepsi) {
      setError("Mohon lengkapi isian wajib yang ditandai dengan tanda bintang (*).");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const targetEmail = mahasiswa?.email || googleEmail || "default_user@ispeak.org";
      const body = { 
        email: targetEmail,
        mahasiswa_id: targetEmail, 
        nama,
        program_studi: prodi, 
        umur: Number(umur), 
        jenis_kelamin: jk, 
        kota_asal: kota,
        domisili_sekarang: domisiliSekarang,
        asal_kampus: asalKampus,
        jenis_tes: jenisTes,
        skor_tes: skorTes,
        persepsi
      };
      const res = await fetch(`/api/mahasiswa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        throw new Error("Gagal menyimpan biodata pelengkap ke Firebase Firestore.");
      }
      const j = await res.json();
      setMahasiswa(j?.mahasiswa);
      setStep(1);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [mahasiswa, googleEmail, nama, prodi, umur, jk, kota, domisiliSekarang, asalKampus, jenisTes, skorTes, persepsi]);

  // Memuat tugas asesmen sesuai indeks langkah saat ini
  useEffect(() => {
    let active = true;
    async function loadTugas() {
      if (step >= 1 && step <= 6) {
        setError("");
        setCurrentTugas(null);
        setImageForTask4(null);
        setRecordReady(false);
        reset();
        try {
          const res = await fetch(`/api/tugas?index=${step}`);
          if (!res.ok) throw new Error("Gagal mengambil tugas");
          const j = await res.json();
          if (!active) return;
          setCurrentTugas(j?.tugas || null);
          
          if (step === 4) {
            try {
              const gres = await fetch('/api/gambar/random');
              if (gres.ok) {
                const gj = await gres.json();
                if (gj?.gambar) setImageForTask4(gj.gambar);
              }
            } catch (_) {}
          }
        } catch (e) {
          if (!active) return;
          setError(e?.message || String(e));
        }
      }
    }
    loadTugas();
    return () => { active = false; };
  }, [step, reset]);

  const alreadyUploaded = useMemo(() => (
    !!currentTugas && uploaded.some((x) => x?.tugas?.id === currentTugas?.id)
  ), [uploaded, currentTugas]);

  // Menjalankan pewaktu persiapan dan perekaman
  useEffect(() => {
    if (!currentTugas || alreadyUploaded) return;
    const taskId = currentTugas?.id ?? null;
    if (taskId && lastStartedTaskIdRef.current === taskId) return;

    let prepTimer = null;
    let recTimer = null;

    async function runTaskTimers() {
      const ok = await requestPermission();
      if (!ok) return;

      const prep = Number(currentTugas?.prep_time || 0);
      const rec = Number(currentTugas?.record_time || 0);
      setPrepLeft(prep);
      setRecLeft(rec);
      setRecordReady(false);

      if (taskId) lastStartedTaskIdRef.current = taskId;

      function startRecordCountdown() {
        setRecordReady(true);
        setTimeout(() => {
          start();
          const recEndAt = Date.now() + rec * 1000;
          recTimer = setInterval(() => {
            const msLeft = recEndAt - Date.now();
            if (msLeft <= 0) {
              setRecLeft(0);
              clearInterval(recTimer);
              try { stop(); } catch (_) {}
            } else {
              setRecLeft(Math.ceil(msLeft / 1000));
            }
          }, 250);
        }, 250);
      }

      if (prep > 0) {
        const prepEndAt = Date.now() + prep * 1000;
        prepTimer = setInterval(() => {
          const msLeft = prepEndAt - Date.now();
          if (msLeft <= 0) {
            setPrepLeft(0);
            clearInterval(prepTimer);
            setTimeout(() => startRecordCountdown(), 200);
          } else {
            setPrepLeft(Math.ceil(msLeft / 1000));
          }
        }, 250);
      } else {
        startRecordCountdown();
      }
    }

    runTaskTimers();

    return () => {
      if (prepTimer) clearInterval(prepTimer);
      if (recTimer) clearInterval(recTimer);
    };
  }, [currentTugas, alreadyUploaded, requestPermission, start, stop]);

  // 3. Mengunggah audio ke rute internal Next.js API Firebase Storage
  useEffect(() => {
    async function upload() {
      if (!chunks || chunks.length === 0) return;
      if (!currentTugas?.id) return;
      if (alreadyUploaded) return;
      try {
        setLoading(true);
        const blob = chunks[0]; // chunks[0] is the WAV blob
        const targetEmail = mahasiswa?.email || mahasiswa?.id || googleEmail || "default_user@ispeak.org";
        const file = new File([blob], `${targetEmail}_${currentTugas.id}.wav`, { type: "audio/wav" });
        
        const refTopic = (step === 4 && imageForTask4?.topic)
          ? imageForTask4.topic
          : (currentTugas?.teks || "");
  
        const fd = new FormData();
        fd.set("email", String(targetEmail));
        fd.set("mahasiswa_id", String(targetEmail));
        fd.set("tugas_id", String(currentTugas.id));
        fd.set("tugas_kategori", currentTugas?.kategori || "");
        fd.set("ref_topic", refTopic);
        fd.set("file", file);
  
        // Langsung dikirim ke rute internal Next.js API Firebase Storage
        const res = await fetch(`/api/rekaman`, { method: "POST", body: fd });
        if (!res.ok) {
          const textErr = await res.text().catch(()=>"");
          throw new Error(`Upload GDrive gagal: ${res.status} ${textErr}`);
        }
        
        const j = await res.json();
        
        setUploaded((arr) => [...arr, { 
          tugas: currentTugas, 
          rekaman: j?.rekaman, 
          file, 
          refTopic, 
          stepIndex: step,
          analisis: j?.analisis 
        }]);
        
        reset();
        setRecordReady(false);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    if (!isRecording && recLeft === 0 && recordReady && currentTugas && !alreadyUploaded) {
      upload();
    }
  }, [isRecording, recLeft, recordReady, alreadyUploaded]);

  const canNext = useMemo(() => {
    if (step === -1 || step === 0) return true;
    const ok = uploaded.some((x) => x?.tugas?.id === currentTugas?.id);
    return ok && !isRecording && !loading;
  }, [step, uploaded, currentTugas, isRecording, loading]);

  const nextStep = useCallback(() => {
    if (step >= 1 && step < 6) setStep(step + 1);
    else if (step === 6) setStep(7);
  }, [step]);

  // Logika Inferensi Sisi Klien Tambahan (Kompilasi Whisper Lokal)
  const [scoring, setScoring] = useState(false);
  const [scoreDone, setScoreDone] = useState([]);
  const [scoreResults, setScoreResults] = useState({});
  const [taskProgress, setTaskProgress] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [asrStatus, setAsrStatus] = useState("");
  const [lastStatusAt, setLastStatusAt] = useState(0);
  const prevStatusRef = useRef("");
  const [whisper, setWhisper] = useState(getWhisperState());
  const pendingItemsRef = useRef([]);

  useEffect(() => {
    const unsub = subscribeWhisper((st) => setWhisper(st));
    return () => { if (typeof unsub === "function") unsub(); };
  }, []);

  const percentFromStatus = useCallback((s) => {
    const m = String(s || "").match(/(\d{1,3})%/);
    const n = m ? Number(m[1]) : null;
    if (n !== null && isFinite(n)) return Math.max(0, Math.min(100, n));
    return null;
  }, []);

  const runScoring = useCallback(async () => {
    setScoring(true);
    setError("");
    setTaskProgress(uploaded.map(() => 0));
    setCurrentIdx(-1);
    try {
      const itemsToCompute = uploaded
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it?.stepIndex === 6);

      if (itemsToCompute.length === 0) {
        setError("Rekaman Tugas 6 belum tersedia.");
        return;
      }

      for (let k = 0; k < itemsToCompute.length; k++) {
        const i = itemsToCompute[k].idx;
        const item = itemsToCompute[k].it;
        const recId = item?.rekaman?.id;
        if (!recId) continue;
        setCurrentIdx(i);
        setAsrStatus("Mempersiapkan mesin evaluasi klien...");
        setLastStatusAt(Date.now());
        
        const refText = item?.refTopic || item?.tugas?.teks || "";
        const res = await featureRef.current.compute(item.file, refText);
        const features = res?.features;
        if (!features) throw new Error("Feature extraction gagal");
        
        pendingItemsRef.current.push({ rekaman_id: recId, features });
        setScoreResults((prev) => ({ ...prev, [recId]: res }));
        setScoreDone((arr) => [...arr, recId]);
        setTaskProgress((arr) => arr.map((v, idx) => idx === i ? 100 : v));
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || String(e));
    } finally {
      setScoring(false);
      setCurrentIdx(-1);
    }
  }, [uploaded]);

  return (
    <div>
      <FeatureComputer
        ref={featureRef}
        onStatus={useCallback((s) => {
          if (s !== prevStatusRef.current) {
            prevStatusRef.current = s;
            setAsrStatus(s);
            setLastStatusAt(Date.now());
          }
          const p = percentFromStatus(s);
          if (currentIdx >= 0 && p !== null) {
            setTaskProgress((prev) => {
              const old = prev[currentIdx] ?? 0;
              const np = Math.max(0, Math.min(100, Math.round(p)));
              if (Math.round(old) === np) return prev;
              return prev.map((v, idx) => (idx === currentIdx ? np : v));
            });
          }
        }, [currentIdx, percentFromStatus])}
      />
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 md:hidden">
            <Image src="/loogo.png" alt="I‑Speak Logo" width={40} height={40} className="rounded-full shadow-sm" />
            <div className="flex flex-col">
              <div className="text-lg font-semibold">I‑Speak</div>
              <div className="text-xs text-neutral-500">Automated Speech Assessment</div>
            </div>
          </div>
          <h1 className="hidden md:block text-3xl font-extrabold tracking-tight">I‑Speak</h1>
          {mahasiswa && (
            <div className="text-sm font-medium text-blue-900 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              {mahasiswa?.nama} · Tugas {Math.max(1, Math.min(step, 6))}/6
            </div>
          )}
        </div>

        {/* Indikator Progres Tugas */}
        {step >= 0 && (
          <div className="w-full h-2 bg-gray-100 rounded-full mb-6 overflow-hidden border border-gray-200/60 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 rounded-full"
              style={{ width: `${Math.max(0, Math.min(step, 6)) / 6 * 100}%` }}
            />
          </div>
        )}

        {error && (
          <div className="p-4 mb-6 text-sm font-medium text-red-800 bg-red-50 rounded-xl border border-red-200 shadow-sm animate-pulse">
            ⚠️ {error}
          </div>
        )}

        {authMsg && (
          <div className="p-4 mb-6 text-sm font-medium text-blue-900 bg-blue-50 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3">
            <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            {authMsg}
          </div>
        )}

        {/* LANGKAH -1: Antarmuka Autentikasi Google Premium */}
        {step === -1 && (
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl p-8 max-w-lg mx-auto transition-all duration-300 hover:shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>
            
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 mb-3 border border-blue-100">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                Autentikasi Pintar
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Masuk dengan Google</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Sistem akan mendeteksi otomatis apakah Anda pengguna baru atau lama untuk penentuan rute antarmuka.
              </p>
            </div>

            <form onSubmit={onGoogleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Alamat Email Google
                </label>
                <input 
                  required 
                  type="email"
                  value={googleEmail} 
                  onChange={(e) => setGoogleEmail(e.target.value)} 
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  placeholder="email@itenas.ac.id" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5">
                  Nama Lengkap Akun
                </label>
                <input 
                  required 
                  type="text"
                  value={googleName} 
                  onChange={(e) => setGoogleName(e.target.value)} 
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  placeholder="Nama Pengguna" 
                />
              </div>

              <div className="pt-2">
                <button 
                  disabled={loading} 
                  type="submit"
                  className="w-full relative flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-gray-900 to-black px-5 py-3.5 text-sm font-medium text-white shadow-lg shadow-gray-900/20 transition-all hover:scale-[1.01] hover:shadow-xl active:scale-[0.99] disabled:opacity-70"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  {loading ? "Memproses..." : "Lanjutkan dengan Akun Google"}
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-xl bg-gray-50 p-4 border border-gray-100 text-center">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                ⚙️ Simulasi Alur Cerdas Server
              </span>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Jika email belum ada di database VM, Anda akan dialihkan ke Form Biodata. Jika email sudah melengkapi profil, Anda akan <strong>melompati form</strong> langsung ke halaman tes.
              </p>
            </div>
          </div>
        )}

        {/* LANGKAH 0: Carousel E-Consent & Instruksi Lengkap Sebelum Form Biodata */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Indikator Progres Halaman Instruksi */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-2">
              <span className="uppercase tracking-wider">
                {consentSlide <= 8 
                  ? `Petunjuk Penggunaan Sistem · Slide ${consentSlide}/8` 
                  : consentSlide === 9 
                  ? "Persetujuan Partisipasi (E-Consent)" 
                  : "Formulir Registrasi Responden"}
              </span>
              <span className="text-blue-600 font-bold">
                {consentSlide <= 9 ? `${Math.round((consentSlide / 9) * 100)}%` : "100%"}
              </span>
            </div>

            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 transition-all duration-500 rounded-full"
                style={{ width: `${consentSlide <= 9 ? (consentSlide / 9) * 100 : 100}%` }}
              />
            </div>

            {/* SLIDE 1: Selamat Datang */}
            {consentSlide === 1 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="text-center pb-2 border-b border-gray-50">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider border border-blue-100">
                    Pengenalan Sistem
                  </span>
                  <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-3">
                    Selamat Datang di I‑SPeak 2.0
                  </h3>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                  <p>
                    Terima kasih atas kesediaan Anda berpartisipasi dalam pengembangan <strong>I‑SPeak 2.0</strong>.
                  </p>
                  <p>
                    Partisipasi Anda sangat berharga untuk meningkatkan kualitas, keandalan, dan pengalaman pengguna sistem ini.
                  </p>
                  <p className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-xs text-blue-900 font-medium">
                    💡 Mohon baca seluruh instruksi berikut dengan saksama sebelum memulai.
                  </p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => setConsentSlide(2)}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-3 shadow-md transition text-sm"
                  >
                    Selanjutnya
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 2: Tujuan Kegiatan */}
            {consentSlide === 2 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Tujuan Kegiatan</h3>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                  <p>
                    Pada sesi ini, Anda akan menyelesaikan beberapa <em>tugas berbicara (speaking tasks)</em> menggunakan sistem I‑SPeak 2.0. Kegiatan ini bertujuan untuk:
                  </p>
                  <ul className="space-y-2 pl-4 list-disc text-gray-800 font-medium">
                    <li>Menguji fungsi dan kinerja sistem</li>
                    <li>Mengumpulkan data suara untuk keperluan pengembangan</li>
                    <li>Mengevaluasi kejelasan instruksi, alur kerja, dan pengalaman pengguna</li>
                  </ul>
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-900 leading-relaxed">
                    ⚠️ Kegiatan ini <strong>bukan ujian formal</strong>, dan jawaban Anda <strong>tidak memengaruhi nilai akademik atau penilaian kinerja</strong>.
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button 
                    type="button" 
                    onClick={() => setConsentSlide(1)}
                    className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Sebelumnya
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setConsentSlide(3)}
                    className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-2.5 shadow-md transition text-xs"
                  >
                    Selanjutnya
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 3: Persiapan Sebelum Memulai */}
            {consentSlide === 3 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Persiapan Sebelum Memulai</h3>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                  <p>Pastikan Anda telah memenuhi persyaratan berikut:</p>
                  <div className="grid grid-cols-1 gap-2.5 bg-gray-50/80 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">✅</span>
                      <span className="text-xs text-gray-800">Berada di <strong>ruangan yang tenang</strong> dan minim gangguan suara</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">✅</span>
                      <span className="text-xs text-gray-800">Menggunakan <strong>mikrofon yang berfungsi dengan baik</strong> (headset sangat disarankan)</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">✅</span>
                      <span className="text-xs text-gray-800">Perangkat Anda <strong>cukup daya</strong> atau terhubung ke sumber listrik</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">✅</span>
                      <span className="text-xs text-gray-800">Koneksi internet <strong>stabil</strong></span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">✅</span>
                      <span className="text-xs text-gray-800">Duduk dengan posisi nyaman dan siap berbicara dengan jelas</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 italic">
                    Jika tersedia, silakan lakukan <em>uji mikrofon (microphone check)</em> sebelum memulai.
                  </p>
                </div>

                <div className="pt-4 flex justify-between">
                  <button type="button" onClick={() => setConsentSlide(2)} className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Sebelumnya
                  </button>
                  <button type="button" onClick={() => setConsentSlide(4)} className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-2.5 shadow-md transition text-xs">
                    Selanjutnya <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 4: Instruksi Umum */}
            {consentSlide === 4 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Instruksi Umum</h3>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                  <ul className="space-y-3 pl-4 list-disc text-gray-800">
                    <li>Berbicaralah dengan <strong>jelas dan alami</strong>, sesuai suara normal Anda</li>
                    <li>Ikuti <strong>instruksi dan prompt</strong> yang muncul di layar</li>
                    <li>Jangan menekan tombol <strong>“Lanjutkan”</strong> atau <strong>“Kirim”</strong> sebelum selesai berbicara</li>
                    <li>Jangan menyegarkan halaman, menutup peramban, atau keluar dari aplikasi selama proses berlangsung</li>
                    <li>Jika terjadi kendala teknis, ikuti petunjuk di layar atau segera laporkan kepada peneliti</li>
                  </ul>
                </div>

                <div className="pt-4 flex justify-between">
                  <button type="button" onClick={() => setConsentSlide(3)} className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Sebelumnya
                  </button>
                  <button type="button" onClick={() => setConsentSlide(5)} className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-2.5 shadow-md transition text-xs">
                    Selanjutnya <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 5: Jenis Tugas */}
            {consentSlide === 5 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Jenis Tugas</h3>
                </div>

                <div className="text-xs text-gray-700 leading-relaxed space-y-4 max-h-80 overflow-y-auto pr-2">
                  <p className="text-sm">Selama sesi ini, Anda mungkin akan mengerjakan satu atau lebih jenis tugas berikut:</p>
                  
                  <div className="space-y-1.5 border-l-2 border-blue-500 pl-3">
                    <h4 className="font-bold text-gray-900 text-sm">1. Tugas Respons Singkat</h4>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                      <li>Anda akan melihat atau mendengar sebuah pertanyaan</li>
                      <li>Berikan jawaban secara lisan dalam waktu yang tersedia</li>
                      <li>Fokus pada kejelasan jawaban, bukan kecepatan</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-indigo-500 pl-3">
                    <h4 className="font-bold text-gray-900 text-sm">2. Tugas Berbicara Panjang</h4>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                      <li>Anda akan diminta menjelaskan, mendeskripsikan, atau menyampaikan pendapat</li>
                      <li>Gunakan kalimat yang lengkap dan jelas</li>
                      <li>Susun jawaban secara runtut (pembukaan – isi – penutup)</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 border-l-2 border-purple-500 pl-3">
                    <h4 className="font-bold text-gray-900 text-sm">3. Tugas Membaca Nyaring <span className="font-normal text-gray-400">(jika tersedia)</span></h4>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                      <li>Bacalah teks <strong>persis seperti yang tertulis di layar</strong></li>
                      <li>Jangan menambah, menghilangkan, atau mengganti kata</li>
                      <li>Gunakan pelafalan dan intonasi yang wajar</li>
                    </ul>
                  </div>

                  <p className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-500 italic">
                    Indikator <strong>waktu atau progres</strong> dapat muncul di layar. Harap perhatikan dan atur waktu Anda dengan baik.
                  </p>
                </div>

                <div className="pt-2 flex justify-between">
                  <button type="button" onClick={() => setConsentSlide(4)} className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Sebelumnya
                  </button>
                  <button type="button" onClick={() => setConsentSlide(6)} className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-2.5 shadow-md transition text-xs">
                    Selanjutnya <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 6: Selama Perekaman & Kerahasiaan */}
            {consentSlide === 6 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Proses Perekaman & Kerahasiaan</h3>
                </div>

                <div className="text-xs text-gray-700 leading-relaxed space-y-4 max-h-80 overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <h4 className="font-bold text-gray-900 text-sm">Selama Proses Perekaman</h4>
                    <p className="text-neutral-500">Saat perekaman dimulai:</p>
                    <ul className="space-y-1.5 pl-2 text-gray-700">
                      <li>🔴 Mulailah berbicara setelah muncul <strong>indikator perekaman</strong></li>
                      <li>🎤 Terus berbicara hingga perekaman berhenti otomatis atau muncul pemberitahuan selesai</li>
                      <li>⏱ Jika waktu habis, jawaban Anda akan tersimpan secara otomatis</li>
                    </ul>
                    <p className="text-red-800 bg-red-50 p-2 rounded-lg text-[11px] font-medium">
                      Jangan menghentikan perekaman di tengah jalan kecuali jika diinstruksikan.
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    <h4 className="font-bold text-gray-900 text-sm">Penggunaan Data dan Kerahasiaan</h4>
                    <ul className="list-disc pl-4 space-y-1 text-gray-600">
                      <li>Rekaman suara Anda digunakan <strong>hanya untuk keperluan penelitian dan pengembangan sistem</strong></li>
                      <li>Seluruh data akan diperlakukan secara <strong>rahasia</strong> dan dianonimkan bila diperlukan</li>
                      <li>Identitas peserta <strong>tidak akan ditampilkan</strong> dalam laporan atau publikasi apa pun</li>
                    </ul>
                  </div>

                  <p className="p-2.5 bg-emerald-50 rounded-xl text-emerald-900 font-medium text-center">
                    ✔ Dengan melanjutkan kegiatan ini, Anda menyatakan telah memahami dan menyetujui ketentuan tersebut.
                  </p>
                </div>

                <div className="pt-2 flex justify-between">
                  <button type="button" onClick={() => setConsentSlide(5)} className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Sebelumnya
                  </button>
                  <button type="button" onClick={() => setConsentSlide(7)} className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-2.5 shadow-md transition text-xs">
                    Selanjutnya <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 7: Setelah Selesai */}
            {consentSlide === 7 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Setelah Selesai</h3>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                  <p>Setelah seluruh tugas selesai:</p>
                  <ul className="space-y-2 pl-4 list-disc text-gray-800">
                    <li>Perhatikan <strong>pesan konfirmasi</strong> yang muncul di layar</li>
                    <li>Jangan mengulangi sesi kecuali diminta oleh peneliti</li>
                    <li>Anda mungkin diminta memberikan <strong>umpan balik</strong> terkait pengalaman penggunaan sistem</li>
                  </ul>
                  <p className="pt-2 text-xs text-blue-600 font-semibold text-center">
                    ✨ Masukan Anda sangat berarti bagi penyempurnaan <strong>I‑SPeak 2.0</strong>.
                  </p>
                </div>

                <div className="pt-4 flex justify-between">
                  <button type="button" onClick={() => setConsentSlide(6)} className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Sebelumnya
                  </button>
                  <button type="button" onClick={() => setConsentSlide(8)} className="flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-2.5 shadow-md transition text-xs">
                    Selanjutnya <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 8: Pengingat Penting & Kesiapan */}
            {consentSlide === 8 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-5 transition-all">
                <div className="border-b border-gray-50 pb-3">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Pengingat Penting</h3>
                </div>

                <div className="text-sm text-gray-700 leading-relaxed space-y-4">
                  <p>Tidak ada <strong>jawaban benar atau salah</strong> dalam kegiatan ini.<br />Hal terpenting adalah:</p>
                  
                  <blockquote className="border-l-4 border-blue-600 bg-gradient-to-r from-blue-50/50 to-transparent p-4 rounded-r-xl italic text-gray-800 font-medium">
                    &ldquo;Berbicara secara alami, mengikuti instruksi, dan menyelesaikan setiap tugas sebaik mungkin.&rdquo;
                  </blockquote>

                  <div className="pt-2 border-t border-gray-100">
                    <h4 className="font-bold text-gray-900 text-sm mb-1">Jika Anda Sudah Siap</h4>
                    <p className="text-xs text-gray-600">
                      Silakan klik <strong>“Mulai Sesi”</strong> di bawah ini untuk melanjutkan ke formulir registrasi dan memulai perekaman.
                    </p>
                  </div>
                  
                  <p className="text-xs text-neutral-400 text-center pt-1">
                    Terima kasih atas kontribusi Anda dalam pengembangan <strong>I‑SPeak 2.0</strong>.
                  </p>
                </div>

                <div className="pt-4 flex justify-between items-center">
                  <button type="button" onClick={() => setConsentSlide(7)} className="flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-5 py-2.5 transition text-xs">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Sebelumnya
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setConsentSlide(9)}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-3 shadow-lg shadow-blue-600/20 transition hover:scale-[1.02] text-sm"
                  >
                    Lanjutkan ke E-Consent ➔
                  </button>
                </div>
              </div>
            )}

            {/* SLIDE 9: PERSETUJUAN SETELAH PENJELASAN (E-CONSENT) */}
            {consentSlide === 9 && (
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-6 transition-all animate-fadeIn">
                <div className="border-b border-gray-100 pb-4 text-center">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-100 inline-block mb-2">
                    Dokumen Legal & Etika
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                    PERSETUJUAN SETELAH PENJELASAN (E‑CONSENT)
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">Penelitian I‑SPeak 2.0</p>
                  <p className="text-[11px] text-neutral-400 mt-1">Harap baca seluruh informasi berikut dengan saksama sebelum melanjutkan.</p>
                </div>

                <div className="text-xs text-gray-700 leading-relaxed space-y-4 max-h-80 overflow-y-auto pr-2 divide-y divide-gray-50">
                  <div className="space-y-1.5 pt-2">
                    <h4 className="font-bold text-gray-900 text-sm">Informasi Penelitian</h4>
                    <p>
                      Anda diundang untuk berpartisipasi dalam penelitian <strong>Pengembangan Sistem Automated Speaking Assessment I‑SPeak 2.0</strong>, sebuah penelitian yang bertujuan mengembangkan dan mengevaluasi sistem penilaian kemampuan berbicara bahasa Inggris berbasis Artificial Intelligence (AI).
                    </p>
                    <p>
                      Partisipasi Anda bersifat sukarela dan digunakan khusus untuk keperluan penelitian dan pengembangan sistem.
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-3">
                    <h4 className="font-bold text-gray-900 text-sm">Apa yang Akan Anda Lakukan</h4>
                    <p className="text-neutral-500">Jika Anda setuju untuk berpartisipasi, Anda akan diminta untuk:</p>
                    <ul className="list-disc pl-4 space-y-1 text-gray-700">
                      <li>Mengikuti instruksi pada sistem I‑SPeak 2.0</li>
                      <li>Menyelesaikan beberapa tugas berbicara (misalnya membaca teks, mendeskripsikan gambar, atau berbicara bebas)</li>
                      <li>(Opsional) Memberikan umpan balik singkat tentang pengalaman penggunaan sistem</li>
                    </ul>
                    <p className="text-blue-800 font-medium pt-0.5">⏱ Waktu yang dibutuhkan sekitar 15–30 menit.</p>
                  </div>

                  <div className="space-y-1.5 pt-3">
                    <h4 className="font-bold text-gray-900 text-sm">Risiko dan Ketidaknyamanan</h4>
                    <ul className="list-disc pl-4 space-y-1 text-gray-700">
                      <li>Risiko tergolong minimal</li>
                      <li>Kemungkinan ketidaknyamanan berupa rasa gugup saat berbicara</li>
                      <li>Anda dapat berhenti kapan saja tanpa konsekuensi apa pun</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 pt-3">
                    <h4 className="font-bold text-gray-900 text-sm">Manfaat</h4>
                    <ul className="list-disc pl-4 space-y-1 text-gray-700">
                      <li>Tidak terdapat manfaat langsung bagi partisipan</li>
                      <li>Kontribusi Anda membantu pengembangan teknologi asesmen bahasa yang lebih objektif dan adil</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 pt-3">
                    <h4 className="font-bold text-gray-900 text-sm">Kerahasiaan Data</h4>
                    <ul className="list-disc pl-4 space-y-1 text-gray-700">
                      <li>Rekaman suara dan data Anda akan dianonimkan</li>
                      <li>Identitas pribadi tidak akan ditampilkan dalam laporan atau publikasi</li>
                      <li>Data hanya diakses oleh tim peneliti dan digunakan untuk kepentingan akademik</li>
                    </ul>
                  </div>

                  <div className="space-y-1.5 pt-3">
                    <h4 className="font-bold text-gray-900 text-sm">Hak Anda sebagai Partisipan</h4>
                    <ul className="list-disc pl-4 space-y-1 text-gray-700">
                      <li>Keikutsertaan bersifat sukarela</li>
                      <li>Anda dapat menolak atau mengundurkan diri kapan saja</li>
                      <li>Tidak ada konsekuensi akademik atau pribadi atas keputusan Anda</li>
                    </ul>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <span>✅</span> Pernyataan Persetujuan
                    </h4>
                    <p className="text-[11px] text-gray-500">Silakan beri tanda centang (✓) pada pernyataan berikut:</p>
                    
                    <div className="space-y-2.5 pt-1">
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition">
                        <input type="checkbox" checked={c1} onChange={(e) => setC1(e.target.checked)} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                        <span className="text-xs text-gray-800 select-none">Saya telah membaca dan memahami informasi penelitian di atas.</span>
                      </label>
                      
                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition">
                        <input type="checkbox" checked={c2} onChange={(e) => setC2(e.target.checked)} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                        <span className="text-xs text-gray-800 select-none">Saya memahami bahwa partisipasi saya bersifat sukarela dan saya dapat mengundurkan diri kapan saja tanpa konsekuensi.</span>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition">
                        <input type="checkbox" checked={c3} onChange={(e) => setC3(e.target.checked)} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                        <span className="text-xs text-gray-800 select-none">Saya memahami bahwa data dan rekaman suara saya akan dijaga kerahasiaannya dan digunakan hanya untuk keperluan penelitian.</span>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition">
                        <input type="checkbox" checked={c4} onChange={(e) => setC4(e.target.checked)} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                        <span className="text-xs text-gray-800 select-none">Saya menyatakan bahwa saya berusia 18 tahun atau lebih.</span>
                      </label>

                      <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 transition">
                        <input type="checkbox" checked={c5} onChange={(e) => setC5(e.target.checked)} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" />
                        <span className="text-xs text-gray-800 select-none">Saya setuju untuk berpartisipasi dalam penelitian ini.</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      alert("Anda memilih untuk tidak setuju. Perekaman dibatalkan.");
                      window.location.reload();
                    }}
                    className="w-full sm:w-auto rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-medium px-5 py-3 transition text-xs border border-red-100 text-center"
                  >
                    Saya Tidak Setuju
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button type="button" onClick={() => setConsentSlide(8)} className="rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-3 transition text-xs">
                      Kembali
                    </button>
                    
                    <button 
                      type="button" 
                      disabled={!(c1 && c2 && c3 && c4 && c5)}
                      onClick={() => setConsentSlide(10)}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold px-6 py-3 shadow-md transition text-xs flex items-center gap-1.5"
                    >
                      Saya Setuju & Lanjutkan
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {!(c1 && c2 && c3 && c4 && c5) && (
                  <p className="text-[10px] text-amber-600 text-center italic mt-1">
                    *Peserta hanya dapat melanjutkan ke sesi berikutnya jika semua kotak persetujuan telah dicentang.
                  </p>
                )}
              </div>
            )}

            {/* SLIDE 10: FORM BIODATA ASLI */}
            {consentSlide === 10 && (
              <form onSubmit={onSubmitMahasiswa} className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-gray-100 space-y-6 transition-all animate-fadeIn">
                <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">I‑Speak Assessment</h3>
                    <p className="text-xs text-gray-500 mt-1">Lengkapi data akademik dan profil tes Anda sebelum memulai sesi.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setConsentSlide(9)} 
                    className="text-[10px] text-blue-600 font-semibold underline hover:text-blue-800"
                  >
                    ← Lihat Dokumen E-Consent
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
                    <input required value={nama} onChange={(e)=>setNama(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" placeholder="Your full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Major / Program</label>
                    <input required value={prodi} onChange={(e)=>setProdi(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" placeholder="e.g., Informatics" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Age</label>
                    <input required type="number" min={1} value={umur} onChange={(e)=>setUmur(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Gender *</label>
                    <select required value={jk} onChange={(e)=>setJk(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900">
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">City</label>
                    <input value={kota} onChange={(e)=>setKota(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" placeholder="City" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Current Residence</label>
                    <input value={domisiliSekarang} onChange={(e)=>setDomisiliSekarang(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" placeholder="Current Residence" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Campus</label>
                    <input value={asalKampus} onChange={(e)=>setAsalKampus(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" placeholder="Campus Name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Test Type *</label>
                    <select required value={jenisTes} onChange={(e)=>setJenisTes(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900">
                      <option value="">Select Test Type</option>
                      <option value="TOEFL ITP / PBT">TOEFL ITP / PBT</option>
                      <option value="TOEFL iBT">TOEFL iBT</option>
                      <option value="IELTS">IELTS</option>
                      <option value="Duolingo English Test">Duolingo English Test</option>
                      <option value="TOEIC">TOEIC</option>
                      <option value="Lainnya / Belum Pernah">Lainnya / Belum Pernah</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Test Score (Optional)</label>
                    <input value={skorTes} onChange={(e)=>setSkorTes(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900" placeholder="0" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Perception *</label>
                    <select required value={persepsi} onChange={(e)=>setPersepsi(e.target.value)} className="w-full border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 p-3 rounded-xl bg-gray-50/50 text-sm outline-none transition text-gray-900">
                      <option value="">Select Perception Level</option>
                      <option value="Dasar (Beginner)">Dasar (Beginner)</option>
                      <option value="Menengah (Intermediate)">Menengah (Intermediate)</option>
                      <option value="Mahir (Advanced)">Mahir (Advanced)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button disabled={loading} type="submit" className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all text-white font-bold px-8 py-3.5 shadow-md shadow-blue-600/20 text-sm hover:scale-[1.01] active:scale-[0.99]">
                    {loading ? "Menyimpan..." : "Simpan & Mulai Tugas 1"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* LANGKAH 1..6: Halaman Asesmen & Perekaman Dinamis */}
        {step >= 1 && step <= 6 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sesi Perekaman Aktif
              </span>
              <div className={`text-xs px-3 py-1 rounded-full font-medium border ${supported ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                {supported ? "🟢 Mikrofon Terhubung" : "🔴 Mikrofon Tidak Didukung"}
              </div>
            </div>

            {permissionError && (
              <div className="flex items-center justify-between text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                <span>Isu mikrofon: {permissionError}</span>
                <button onClick={requestPermission} className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">Coba Ulang Akses</button>
              </div>
            )}

            <div className="p-8 bg-white/80 backdrop-blur-md rounded-2xl border border-gray-100 shadow-xl relative overflow-hidden transition-all">
              {/* Dekorasi sudut */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50/20 rounded-bl-full pointer-events-none"></div>

              <div className="text-center relative z-10">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100 inline-block mb-2">
                  {currentTugas?.kategori}
                </span>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  {currentTugas?.judul || `Tugas ${step}`}
                </h2>
                
                <div className="mt-6 flex items-center justify-center gap-12 p-4 bg-gray-50/80 rounded-2xl border border-gray-100/80 max-w-sm mx-auto">
                  <Countdown
                    label="Persiapan"
                    total={Number(currentTugas?.prep_time||0)}
                    remaining={prepLeft}
                    color="#0284c7"
                    active={prepLeft > 0}
                  />
                  <div className="w-px h-10 bg-gray-200"></div>
                  <Countdown
                    label="Perekaman"
                    total={Number(currentTugas?.record_time||0)}
                    remaining={recLeft}
                    color="#dc2626"
                    active={isRecording || (recordReady && recLeft > 0)}
                  />
                </div>
              </div>

              <div className="mt-8 relative z-10">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  Teks Prompt Acuan:
                </span>
                <p className="whitespace-pre-wrap border border-gray-100/80 rounded-xl p-5 bg-white text-gray-800 text-base leading-relaxed shadow-sm">
                  {currentTugas?.teks}
                </p>
              </div>

              {step === 4 && (
                <div className="mt-6 relative z-10">
                  {imageForTask4?.image_url || imageForTask4?.resolved_url ? (
                    <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Deskripsikan Gambar Berikut:</div>
                      <img
                        src={imageForTask4?.resolved_url || imageForTask4?.image_url}
                        alt="Task Prompt Image"
                        className="w-full max-h-72 object-contain rounded-lg shadow-sm"
                        onError={(e)=>{ e.currentTarget.style.display='none'; }}
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {!alreadyUploaded && (
                <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-xs relative z-10">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-red-600 animate-ping" : recordReady ? "bg-red-500" : "bg-amber-500"}`}></span>
                    <span className="font-medium text-gray-700">
                      Status: {isRecording ? "Sedang Merekam Suara..." : recordReady ? "Perekaman Dimulai" : "Menunggu Waktu Persiapan Habis"}
                    </span>
                  </div>
                  {(!supported || permissionError) && (
                    <button onClick={requestPermission} className="px-3 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 font-medium">Aktifkan Mikrofon</button>
                  )}
                </div>
              )}

              {alreadyUploaded && (
                <div className="mt-8 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-green-700 font-medium relative z-10">
                  <svg className="w-4 h-4 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  File audio telah tersimpan dengan aman di subfolder Google Drive.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button 
                onClick={nextStep} 
                disabled={!canNext} 
                className="rounded-xl bg-gray-900 hover:bg-black transition text-white font-medium px-6 py-3 shadow-lg shadow-gray-900/10 text-sm disabled:opacity-50"
              >
                {step < 6 ? (loading ? "Mengunggah Audio..." : "Lanjutkan ke Tugas Berikutnya") : "Selesaikan Seluruh Tugas"}
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 7: Ringkasan Selesai (Mendukung Tampilan Collect Data Murni & Sakelar Analisis Lengkap) */}
        {step === 7 && (() => {
          // Sakelar (Toggle) untuk menampilkan hasil ekstraksi ML asli jika suatu saat diaktifkan kembali
          const showFullMLResults = false;

          if (!showFullMLResults) {
            return (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden text-center">
                  <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 inline-block mb-3">
                    Fase Pengumpulan Data Selesai
                  </span>
                  
                  <h2 className="text-3xl font-extrabold tracking-tight">Pengumpulan Audio Berhasil ✨</h2>
                  <p className="text-xs text-emerald-50 max-w-md mx-auto mt-2">
                    Seluruh rekaman suara Anda telah disimpan secara aman dan terstruktur di Google Drive Riset serta tercatat pada Firestore Database. Ekstraksi fitur ML berat sengaja dilewati pada fase ini.
                  </p>
                </div>

                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                  Daftar Rekaman Audio Tersimpan ({uploaded.length} Tugas Selesai)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uploaded.map((u, i) => {
                    return (
                      <div key={i} className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-gray-100 shadow-md flex flex-col justify-between transition hover:shadow-lg">
                        <div>
                          <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-3">
                            <span className="font-bold text-gray-900 text-sm">{u.tugas?.judul}</span>
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100/60 px-2 py-0.5 rounded-full uppercase">
                              Tersimpan Fisik
                            </span>
                          </div>
                          
                          <audio src={URL.createObjectURL(u.file)} controls className="w-full h-9 mt-1" />
                        </div>

                        <div className="mt-4 pt-2.5 border-t border-gray-50 flex items-center justify-between text-[11px] text-gray-500">
                          <span>Kategori: <strong>{u.tugas?.kategori}</strong></span>
                          <span className="text-emerald-600 font-medium">✔ Siap Diekstraksi Nanti</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-center pt-6 border-t border-gray-100">
                  <button 
                    onClick={() => { 
                      window.location.reload(); 
                    }} 
                    className="rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-8 py-3.5 shadow-lg shadow-gray-900/10 text-sm transition"
                  >
                    Kembali ke Menu Utama / Responden Berikutnya
                  </button>
                </div>
              </div>
            );
          }

          // ===================================================================
          // KODE ASLI UI ANALISIS CEFR (DISEMBUNYIKAN/TETAP DIPERTAHANKAN)
          // ===================================================================
          const task6 = uploaded.find((u) => u?.stepIndex === 6);
          const hasilServer = task6?.analisis;
          const cefrLabel = hasilServer?.skor_cefr_label || "-";
          const CEFR_DESC = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper-Intermediate", C1: "Advanced", C2: "Proficient" };
          
          return (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                
                <span className="text-[10px] font-bold tracking-widest uppercase bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 inline-block mb-3">
                  Hasil Inferensi Terpadu
                </span>
                
                <div>
                  <div className="text-xs text-white/80 uppercase tracking-wider mb-1">Tingkat Kemahiran Berbicara (CEFR)</div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-extrabold tracking-tight">{cefrLabel}</span>
                    <span className="text-lg font-medium text-white/90">{CEFR_DESC[cefrLabel] || ""}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                Rincian Audio & Ekstraksi Fitur Per Tugas ({uploaded.length} Selesai)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uploaded.map((u, i) => {
                  const tr = u?.analisis?.transkrip || "";
                  const fit = u?.analisis?.fitur_numerik || {};
                  const sub = u?.analisis?.skor_subkonstruk || {};
                  
                  return (
                    <div key={i} className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-gray-100 shadow-md flex flex-col justify-between transition hover:shadow-lg">
                      <div>
                        <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-3">
                          <span className="font-bold text-gray-900 text-sm">{u.tugas?.judul}</span>
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase">
                            {u.tugas?.kategori}
                          </span>
                        </div>
                        
                        <audio src={URL.createObjectURL(u.file)} controls className="w-full h-8 mb-3" />

                        {tr && (
                          <div className="mt-2 bg-gray-50/80 rounded-xl p-3 border border-gray-100/50">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                              Hasil Transkripsi Whisper
                            </span>
                            <p className="text-xs text-gray-700 line-clamp-3 italic leading-relaxed">
                              &ldquo;{tr}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-blue-50/50 p-2 rounded-lg">
                          <span className="text-[9px] text-gray-500 block">WPM</span>
                          <span className="text-xs font-bold text-blue-700">{Math.round(fit["WPM"] || 0)}</span>
                        </div>
                        <div className="bg-green-50/50 p-2 rounded-lg">
                          <span className="text-[9px] text-gray-500 block">Fluensi</span>
                          <span className="text-xs font-bold text-green-700">{sub["Fluency"] || 0}</span>
                        </div>
                        <div className="bg-purple-50/50 p-2 rounded-lg">
                          <span className="text-[9px] text-gray-500 block">Akurasi</span>
                          <span className="text-xs font-bold text-purple-700">{sub["Accuracy"] || 0}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end pt-4">
                <button 
                  onClick={() => { 
                    window.location.reload(); 
                  }} 
                  className="rounded-xl bg-gray-900 hover:bg-black text-white font-medium px-6 py-3 shadow text-sm transition"
                >
                  Mulai Ulang Asesmen
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
