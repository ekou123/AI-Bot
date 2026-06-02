import { useEffect, useMemo, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import "./ViolinTuner.css";

/* ------------------------------------------------------------------ */
/*  Music theory data                                                  */
/* ------------------------------------------------------------------ */

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

const FLAT_TO_PC: Record<string, number> = {
  "C♭": 11, "D♭": 1, "E♭": 3, "F♭": 4, "G♭": 6, "A♭": 8, "B♭": 10,
};

const toPitchClass = (name: string): number =>
  FLAT_TO_PC[name] !== undefined ? FLAT_TO_PC[name] : NOTE_NAMES.indexOf(name);

type ScaleType = "major" | "minor";
type ScaleStep = { name: string; frequency: number };

const INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
};

type KeyDef = { root: string; notes: string[] };

const MAJOR_KEYS: KeyDef[] = [
  { root: "C",  notes: ["C",  "D",  "E",  "F",  "G",  "A",  "B",  "C"]  },
  { root: "G",  notes: ["G",  "A",  "B",  "C",  "D",  "E",  "F♯", "G"]  },
  { root: "D",  notes: ["D",  "E",  "F♯", "G",  "A",  "B",  "C♯", "D"]  },
  { root: "A",  notes: ["A",  "B",  "C♯", "D",  "E",  "F♯", "G♯", "A"]  },
  { root: "E",  notes: ["E",  "F♯", "G♯", "A",  "B",  "C♯", "D♯", "E"]  },
  { root: "B",  notes: ["B",  "C♯", "D♯", "E",  "F♯", "G♯", "A♯", "B"]  },
  { root: "F♯", notes: ["F♯", "G♯", "A♯", "B",  "C♯", "D♯", "F",  "F♯"] },
  { root: "F",  notes: ["F",  "G",  "A",  "B♭", "C",  "D",  "E",  "F"]  },
  { root: "B♭", notes: ["B♭", "C",  "D",  "E♭", "F",  "G",  "A",  "B♭"] },
  { root: "E♭", notes: ["E♭", "F",  "G",  "A♭", "B♭", "C",  "D",  "E♭"] },
  { root: "A♭", notes: ["A♭", "B♭", "C",  "D♭", "E♭", "F",  "G",  "A♭"] },
  { root: "D♭", notes: ["D♭", "E♭", "F",  "G♭", "A♭", "B♭", "C",  "D♭"] },
];

const MINOR_KEYS: KeyDef[] = [
  { root: "A",  notes: ["A",  "B",  "C",  "D",  "E",  "F",  "G",  "A"]  },
  { root: "E",  notes: ["E",  "F♯", "G",  "A",  "B",  "C",  "D",  "E"]  },
  { root: "B",  notes: ["B",  "C♯", "D",  "E",  "F♯", "G",  "A",  "B"]  },
  { root: "F♯", notes: ["F♯", "G♯", "A",  "B",  "C♯", "D",  "E",  "F♯"] },
  { root: "C♯", notes: ["C♯", "D♯", "E",  "F♯", "G♯", "A",  "B",  "C♯"] },
  { root: "G♯", notes: ["G♯", "A♯", "B",  "C♯", "D♯", "E",  "F♯", "G♯"] },
  { root: "D♯", notes: ["D♯", "F",  "F♯", "G♯", "A♯", "B",  "C♯", "D♯"] },
  { root: "D",  notes: ["D",  "E",  "F",  "G",  "A",  "B♭", "C",  "D"]  },
  { root: "G",  notes: ["G",  "A",  "B♭", "C",  "D",  "E♭", "F",  "G"]  },
  { root: "C",  notes: ["C",  "D",  "E♭", "F",  "G",  "A♭", "B♭", "C"]  },
  { root: "F",  notes: ["F",  "G",  "A♭", "B♭", "C",  "D♭", "E♭", "F"]  },
  { root: "B♭", notes: ["B♭", "C",  "D♭", "E♭", "F",  "G♭", "A♭", "B♭"] },
];

// Root starting frequencies — kept in a comfortable mid-range for string instruments.
const ROOT_HZ: Record<string, number> = {
  "G": 196.00, "G♯": 207.65, "A♭": 207.65,
  "A": 220.00, "A♯": 233.08, "B♭": 233.08,
  "B": 246.94,
  "C": 261.63, "C♯": 277.18, "D♭": 277.18,
  "D": 293.66, "D♯": 311.13, "E♭": 311.13,
  "E": 329.63,
  "F": 349.23, "F♯": 369.99, "G♭": 369.99,
};

const ST = 2 ** (1 / 12); // one semitone ratio

function buildScale(key: KeyDef, type: ScaleType, calibrationRatio: number): ScaleStep[] {
  const rootHz = (ROOT_HZ[key.root] ?? 196.0) * calibrationRatio;
  return INTERVALS[type].map((n, i) => ({
    name: key.notes[i],
    frequency: rootHz * ST ** n,
  }));
}

/* ------------------------------------------------------------------ */
/*  Audio / pitch detection constants                                 */
/* ------------------------------------------------------------------ */

const MIN_CLARITY = 0.6;
const MIN_VOLUME_RMS = 0.015;
const PITCH_SMOOTHING = 0.25;
const NO_SIGNAL_DELAY_MS = 500;

const getNoteFromFrequency = (f: number | null) => {
  if (!f || f <= 0) return "—";
  const midi = Math.round(69 + 12 * Math.log2(f / 440));
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
};

const getRms = (buf: Float32Array) => {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
};

/* ------------------------------------------------------------------ */
/*  Gauge geometry (shared with ViolinTuner)                         */
/* ------------------------------------------------------------------ */

const CX = 260, CY = 260, R_TICK = 232;

const TICKS = (() => {
  const out: { x1: number; y1: number; x2: number; y2: number; long: boolean }[] = [];
  for (let deg = -150; deg <= 150; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const long = deg % 30 === 0;
    const ri = long ? 210 : 218;
    out.push({
      x1: CX + ri * Math.sin(rad), y1: CY - ri * Math.cos(rad),
      x2: CX + R_TICK * Math.sin(rad), y2: CY - R_TICK * Math.cos(rad),
      long,
    });
  }
  return out;
})();

const arc = (s: number, e: number, r: number) => {
  const sr = (s * Math.PI) / 180, er = (e * Math.PI) / 180;
  const x1 = CX + r * Math.sin(sr), y1 = CY - r * Math.cos(sr);
  const x2 = CX + r * Math.sin(er), y2 = CY - r * Math.cos(er);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${Math.abs(e - s) > 180 ? 1 : 0} ${e > s ? 1 : 0} ${x2} ${y2}`;
};

const PROG_R = 248;
const PROG_C = 2 * Math.PI * PROG_R;

/* ------------------------------------------------------------------ */

export function ScalePractice() {
  const [calibrationHz, setCalibrationHz] = useState(440);
  const [scaleType, setScaleType] = useState<ScaleType>("major");
  const [scaleRoot, setScaleRoot] = useState("G");
  const [scaleIndex, setScaleIndex] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdMs, setHoldMs] = useState(700);
  const [isActive, setIsActive] = useState(false);
  const [scaleMode, setScaleMode] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("Select a scale and press Start.");

  const scaleModeRef = useRef(false);
  const scaleIndexRef = useRef(0);
  const scaleStepsRef = useRef<ScaleStep[]>([]);
  const holdMsRef = useRef(700);
  const inTuneRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const lastSignalRef = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufRef = useRef<Float32Array | null>(null);

  const activeKeys = scaleType === "major" ? MAJOR_KEYS : MINOR_KEYS;

  const activeKey = useMemo(
    () => activeKeys.find(k => k.root === scaleRoot) ?? activeKeys[0],
    [activeKeys, scaleRoot]
  );

  const scaleSteps = useMemo(
    () => buildScale(activeKey, scaleType, calibrationHz / 440),
    [activeKey, scaleType, calibrationHz]
  );

  useEffect(() => { scaleModeRef.current = scaleMode; }, [scaleMode]);
  useEffect(() => { scaleIndexRef.current = scaleIndex; }, [scaleIndex]);
  useEffect(() => { scaleStepsRef.current = scaleSteps; }, [scaleSteps]);
  useEffect(() => { holdMsRef.current = holdMs; }, [holdMs]);

  const detector = useMemo(
    () => new PitchDetector(2048, (len: number) => new Float32Array(len)),
    []
  );

  const waveBars = useMemo(
    () => Array.from({ length: 41 }, (_, i) => {
      const t = (i - 20) / 20;
      return 6 + Math.cos(t * Math.PI) * 26 * (0.45 + Math.random() * 0.55);
    }),
    [scaleRoot, scaleType]
  );

  /* ---- audio helpers ---- */

  const playChime = (freqs: number[], spacing = 0.08) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * spacing;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    });
  };

  /* ---- scale logic ---- */

  const updateScale = (hz: number) => {
    const steps = scaleStepsRef.current;
    if (!steps.length) return;
    const target = steps[Math.min(scaleIndexRef.current, steps.length - 1)];
    const detClass = ((Math.round(69 + 12 * Math.log2(hz / 440)) % 12) + 12) % 12;
    const onPitch = detClass === toPitchClass(target.name);

    if (onPitch) {
      if (inTuneRef.current === null) inTuneRef.current = performance.now();
      const held = performance.now() - inTuneRef.current;
      setHoldProgress(Math.min(1, held / holdMsRef.current));
      if (held >= holdMsRef.current) {
        inTuneRef.current = null;
        setHoldProgress(0);
        const next = scaleIndexRef.current + 1;
        if (next >= steps.length) {
          playChime([523, 659, 784], 0.12);
          setScaleMode(false);
          scaleModeRef.current = false;
          setMessage("Scale complete!");
          setStatus("idle");
        } else {
          playChime([660, 990]);
          scaleIndexRef.current = next;
          setScaleIndex(next);
          setMessage(`Play ${steps[next].name}`);
        }
      }
    } else {
      inTuneRef.current = null;
      setHoldProgress(0);
    }
  };

  const updatePitch = () => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    const buf = bufRef.current;
    if (!analyser || !ctx || !buf) return;

    analyser.getFloatTimeDomainData(buf as any);
    const rms = getRms(buf);
    const [raw, clarity] = detector.findPitch(buf as any, ctx.sampleRate);
    const strong = raw > 0 && clarity >= MIN_CLARITY && rms >= MIN_VOLUME_RMS;

    if (strong) {
      lastSignalRef.current = performance.now();
      const prev = smoothedRef.current;
      const smoothed = prev === null ? raw : prev + (raw - prev) * PITCH_SMOOTHING;
      smoothedRef.current = smoothed;
      setDetectedPitch(smoothed);

      if (scaleModeRef.current) {
        const steps = scaleStepsRef.current;
        const target = steps[Math.min(scaleIndexRef.current, steps.length - 1)];
        const c = 1200 * Math.log2(smoothed / target.frequency);
        setCents(c);
        setStatus(Math.abs(c) <= 5 ? "in tune" : c > 0 ? "sharp" : "flat");
        updateScale(smoothed);
        const detClass = ((Math.round(69 + 12 * Math.log2(smoothed / 440)) % 12) + 12) % 12;
        setMessage(detClass === toPitchClass(target.name) ? `Hold ${target.name}…` : `Play ${target.name}`);
      } else {
        setCents(null);
        setStatus("listening");
      }
    } else {
      const elapsed = performance.now() - lastSignalRef.current;
      if (elapsed > NO_SIGNAL_DELAY_MS) {
        smoothedRef.current = null;
        inTuneRef.current = null;
        setHoldProgress(0);
        setDetectedPitch(null);
        setCents(null);
        setStatus("no signal");
        if (scaleModeRef.current) {
          const steps = scaleStepsRef.current;
          const target = steps[Math.min(scaleIndexRef.current, steps.length - 1)];
          if (target) setMessage(`Play ${target.name}`);
        }
      }
    }
    rafRef.current = requestAnimationFrame(updatePitch);
  };

  const startAudio = async () => {
    if (isActive) return;
    if (!navigator.mediaDevices?.getUserMedia) { setMessage("Microphone not available."); return; }
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      sourceRef.current = src;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      setIsActive(true);
      setStatus("listening");
      rafRef.current = requestAnimationFrame(updatePitch);
    } catch { setMessage("Could not access microphone."); }
  };

  const stopAudio = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    smoothedRef.current = null;
    lastSignalRef.current = 0;
    inTuneRef.current = null;
  };

  const startScale = () => {
    setScaleIndex(0);
    scaleIndexRef.current = 0;
    setHoldProgress(0);
    inTuneRef.current = null;
    setScaleMode(true);
    scaleModeRef.current = true;
    setMessage(`Play ${scaleSteps[0]?.name ?? "—"}`);
    if (!isActive) startAudio();
  };

  const stopScale = () => {
    setScaleMode(false);
    scaleModeRef.current = false;
    setHoldProgress(0);
    inTuneRef.current = null;
    setDetectedPitch(null);
    setCents(null);
    setStatus("idle");
    setMessage("Select a scale and press Start.");
    stopAudio();
    setIsActive(false);
  };

  const handleTypeChange = (type: ScaleType) => {
    if (scaleMode) return;
    const keys = type === "major" ? MAJOR_KEYS : MINOR_KEYS;
    if (!keys.find(k => k.root === scaleRoot)) setScaleRoot(keys[0].root);
    setScaleType(type);
    setScaleIndex(0);
    setHoldProgress(0);
  };

  const handleRootChange = (root: string) => {
    if (scaleMode) return;
    setScaleRoot(root);
    setScaleIndex(0);
    setHoldProgress(0);
  };

  useEffect(() => { return () => { stopAudio(); }; }, []);

  /* ---- gauge ---- */
  const needleDeg = Math.max(-150, Math.min(150, (cents ?? 0) * 1.4));
  const nr = (needleDeg * Math.PI) / 180;
  const nx = CX + 224 * Math.sin(nr);
  const ny = CY - 224 * Math.cos(nr);
  const target = scaleSteps[Math.min(scaleIndex, scaleSteps.length - 1)];
  const detectedNote = getNoteFromFrequency(detectedPitch);
  const sc = status.replace(" ", "-");
  const sl = status === "idle" ? "IDLE" : status.toUpperCase();

  return (
    <section className="tuner-screen">
      <div className="tuner-main">

        <div className="scale-page-header">
          <h1 className="scale-page-title">Scale Practice</h1>
          <p className="scale-page-sub">Play each note and hold it steady to advance through the scale.</p>
        </div>

        <div className="tuner-cols">
          {/* ── LEFT: selector + controls ── */}
          <div className="strings-col">
            <div className="card scale-card">

              {/* Major / Minor tabs */}
              <div className="scale-type-tabs">
                <button
                  className={`scale-type-tab scale-type-tab--major${scaleType === "major" ? " is-active" : ""}`}
                  onClick={() => handleTypeChange("major")}
                  disabled={scaleMode}
                >
                  Major
                </button>
                <button
                  className={`scale-type-tab scale-type-tab--minor${scaleType === "minor" ? " is-active" : ""}`}
                  onClick={() => handleTypeChange("minor")}
                  disabled={scaleMode}
                >
                  Natural Minor
                </button>
              </div>

              {/* 12 root key buttons */}
              <div className="scale-root-grid">
                {activeKeys.map(k => (
                  <button
                    key={k.root}
                    className={`scale-root-btn scale-root-btn--${scaleType}${scaleRoot === k.root ? " is-active" : ""}`}
                    onClick={() => handleRootChange(k.root)}
                    disabled={scaleMode}
                  >
                    {k.root}
                  </button>
                ))}
              </div>

              {/* Active scale label */}
              <div className={`scale-active-label scale-active-label--${scaleType}`}>
                {activeKey.root}&nbsp;{scaleType === "major" ? "Major" : "Minor"}
              </div>

              {/* Note chips — no octave numbers */}
              <div className="scale-notes">
                {scaleSteps.map((step, i) => (
                  <span
                    key={step.name + i}
                    className={`scale-chip${
                      scaleMode && i === scaleIndex ? " current" :
                      scaleMode && i < scaleIndex ? " done" : ""
                    }`}
                  >
                    {step.name}
                  </span>
                ))}
              </div>

              {/* Hold progress */}
              <div className="scale-progress-track">
                <div className="scale-progress-fill" style={{ width: `${Math.round(holdProgress * 100)}%` }} />
              </div>

              {/* Status message */}
              <div className="panel-status">
                <span className={`status-dot status-dot--${sc}`} />
                <span className="panel-status-text">{message}</span>
              </div>

              {/* Start / Stop */}
              {!scaleMode
                ? <button type="button" className="scale-start-button" onClick={startScale}>Start Scale</button>
                : <button type="button" className="scale-stop-button" onClick={stopScale}>Stop Scale</button>
              }
            </div>

            {/* Settings */}
            <div className="card">
              <div className="card-title">SETTINGS</div>
              <div className="field">
                <label>Reference Pitch</label>
                <div className="select-wrap">
                  <select value={calibrationHz} onChange={e => setCalibrationHz(Number(e.target.value))}>
                    <option value={432}>A4 = 432 Hz</option>
                    <option value={440}>A4 = 440 Hz</option>
                    <option value={442}>A4 = 442 Hz</option>
                    <option value={444}>A4 = 444 Hz</option>
                  </select>
                  <svg className="select-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              <div className="field">
                <label>Hold Time: {holdMs} ms</label>
                <input type="range" min={300} max={1500} step={100} value={holdMs}
                  onChange={e => setHoldMs(Number(e.target.value))} className="range-input" />
              </div>
            </div>
          </div>

          {/* ── RIGHT: gauge ── */}
          <div className="gauge-col">
            <div className="gauge-shell">
              <svg viewBox="0 0 520 520" className="gauge-svg">
                <defs>
                  <linearGradient id="sp-cyan" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1d9bd1" /><stop offset="100%" stopColor="#39c8e6" />
                  </linearGradient>
                  <linearGradient id="sp-purp" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7c5cf0" /><stop offset="100%" stopColor="#b34fe0" />
                  </linearGradient>
                  <linearGradient id="sp-hold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#46e08a" /><stop offset="100%" stopColor="#39c8e6" />
                  </linearGradient>
                  <filter id="sp-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="5" />
                  </filter>
                  <radialGradient id="sp-dial" cx="50%" cy="42%" r="62%">
                    <stop offset="0%" stopColor="rgba(40,52,96,0.40)" />
                    <stop offset="60%" stopColor="rgba(18,24,50,0.25)" />
                    <stop offset="100%" stopColor="rgba(10,14,30,0)" />
                  </radialGradient>
                </defs>

                <circle cx={CX} cy={CY} r={244} fill="url(#sp-dial)" />
                <path d={arc(-150, 150, R_TICK + 4)} fill="none" stroke="rgba(120,130,180,0.12)" strokeWidth="2" strokeLinecap="round" />
                <path d={arc(-150, -18, R_TICK + 4)} fill="none" stroke="url(#sp-cyan)" strokeWidth="3.5" strokeLinecap="round" filter="url(#sp-glow)" opacity="0.9" />
                <path d={arc(-150, -18, R_TICK + 4)} fill="none" stroke="url(#sp-cyan)" strokeWidth="2.5" strokeLinecap="round" />
                <path d={arc(18, 150, R_TICK + 4)} fill="none" stroke="url(#sp-purp)" strokeWidth="3.5" strokeLinecap="round" filter="url(#sp-glow)" opacity="0.9" />
                <path d={arc(18, 150, R_TICK + 4)} fill="none" stroke="url(#sp-purp)" strokeWidth="2.5" strokeLinecap="round" />

                {scaleMode && holdProgress > 0 && (
                  <circle cx={CX} cy={CY} r={PROG_R} fill="none"
                    stroke="url(#sp-hold)" strokeWidth="6" strokeLinecap="round"
                    transform={`rotate(-90 ${CX} ${CY})`}
                    strokeDasharray={PROG_C}
                    strokeDashoffset={PROG_C * (1 - holdProgress)}
                    className="gauge-hold-ring"
                  />
                )}

                {TICKS.map((t, i) => (
                  <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                    stroke={t.long ? "rgba(180,190,230,0.55)" : "rgba(150,160,200,0.28)"}
                    strokeWidth={t.long ? 2 : 1.3} strokeLinecap="round" />
                ))}

                <text x={CX - 138} y={CY + 24} className="gauge-mark-text">-50</text>
                <text x={CX + 112} y={CY + 24} className="gauge-mark-text">+50</text>
                <text x={CX} y={CY - 178} className="gauge-mark-text" textAnchor="middle">0</text>

                <g transform={`translate(${CX}, ${CY - 12})`}>
                  {waveBars.map((h, i) => (
                    <rect key={i} x={(i - 20) * 5.6 - 1.4} y={-h} width={2.8} height={h * 2} rx={1.4} fill="rgba(150,140,235,0.55)" />
                  ))}
                </g>

                <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="rgba(235,238,255,0.85)" strokeWidth="2.5" strokeLinecap="round" className="gauge-needle-line" />
                <circle cx={nx} cy={ny} r={16} fill="rgba(180,180,255,0.18)" />
                <circle cx={nx} cy={ny} r={9} fill="#f3f5ff" className="gauge-needle-dot" />
                <circle cx={CX} cy={CY} r={4} fill="rgba(180,190,235,0.5)" />
              </svg>

              <div className="gauge-readout">
                <div className="gauge-note">{detectedNote}</div>
                <div className="gauge-frequency">
                  {detectedPitch ? `${detectedPitch.toFixed(2)} Hz` : `${target?.frequency.toFixed(2) ?? "—"} Hz`}
                </div>
                <div className={`gauge-status gauge-status--${sc}`}>
                  <span className="status-dot status-dot--listening" />{sl}
                </div>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-cell">
                <span className="summary-label">TARGET</span>
                <strong className="summary-big">{target?.name ?? "—"}</strong>
              </div>
              <div className="summary-divider" />
              <div className="summary-cell">
                <span className="summary-label">DETECTED</span>
                <strong className="summary-big">{detectedNote}</strong>
              </div>
              <div className="summary-divider" />
              <div className="summary-cell">
                <span className="summary-label">PROGRESS</span>
                <strong className="summary-big">
                  {scaleSteps.length > 0 ? `${scaleIndex + (scaleMode ? 1 : 0)} / ${scaleSteps.length - 1}` : "—"}
                </strong>
              </div>
            </div>

            <div className="gauge-message">
              {status === "idle" ? "Ready — press Start Scale to begin" : message}
            </div>

            <div className="gauge-mic-controls">
              <button type="button" className="gauge-mic-start" onClick={startAudio} disabled={isActive}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                Start Mic
              </button>
              <button type="button" className="gauge-mic-stop" onClick={stopScale} disabled={!isActive}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
                Stop
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
