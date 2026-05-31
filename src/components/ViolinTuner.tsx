import { useEffect, useMemo, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import "./ViolinTuner.css";

type NoteTarget = {
  name: string;
  frequency: number;
};

const INSTRUMENT_PRESETS: Record<string, NoteTarget[]> = {
  Violin: [
    { name: "G3", frequency: 196.0 },
    { name: "D4", frequency: 293.66 },
    { name: "A4", frequency: 440.0 },
    { name: "E5", frequency: 659.25 },
  ],
  Viola: [
    { name: "C3", frequency: 130.81 },
    { name: "G3", frequency: 196.0 },
    { name: "D4", frequency: 293.66 },
    { name: "A4", frequency: 440.0 },
  ],
  Cello: [
    { name: "C2", frequency: 65.41 },
    { name: "G2", frequency: 98.0 },
    { name: "D3", frequency: 146.83 },
    { name: "A3", frequency: 220.0 },
  ],
  Guitar: [
    { name: "E2", frequency: 82.41 },
    { name: "A2", frequency: 110.0 },
    { name: "D3", frequency: 146.83 },
    { name: "G3", frequency: 196.0 },
    { name: "B3", frequency: 246.94 },
    { name: "E4", frequency: 329.63 },
  ],
  Ukulele: [
    { name: "G4", frequency: 392.0 },
    { name: "C4", frequency: 261.63 },
    { name: "E4", frequency: 329.63 },
    { name: "A4", frequency: 440.0 },
  ],
  Mandolin: [
    { name: "G3", frequency: 196.0 },
    { name: "D4", frequency: 293.66 },
    { name: "A4", frequency: 440.0 },
    { name: "E5", frequency: 659.25 },
  ],
  Bass: [
    { name: "E1", frequency: 41.2 },
    { name: "A1", frequency: 55.0 },
    { name: "D2", frequency: 73.42 },
    { name: "G2", frequency: 98.0 },
  ],
  Custom: [
    { name: "G3", frequency: 196.0 },
    { name: "D4", frequency: 293.66 },
    { name: "A4", frequency: 440.0 },
    { name: "E5", frequency: 659.25 },
  ],
};

const NOTE_NAMES = [
  "C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B",
];

const MIN_CLARITY = 0.6;
const MIN_VOLUME_RMS = 0.015;
const PITCH_SMOOTHING = 0.25;
const NO_SIGNAL_DELAY_MS = 500;

const formatCents = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}¢`;
};

const getStatus = (cents: number | null) => {
  if (cents === null) return "no signal";
  if (Math.abs(cents) <= 5) return "in tune";
  return cents > 0 ? "sharp" : "flat";
};

const getTuningAdvice = (cents: number | null) => {
  if (cents === null) return "Play the open string and listen for a strong pitch.";
  const abs = Math.abs(cents);
  if (abs > 30) return "Use the peg for a larger adjustment, then fine-tune with the tuner.";
  if (abs > 10) return "Use the fine tuner for a stronger adjustment toward the target.";
  if (abs > 5) return "Use the fine tuner gently to approach the target.";
  return "String is nearly in tune — use the fine tuner to lock it in.";
};

const getNoteFromFrequency = (frequency: number | null) => {
  if (!frequency || frequency <= 0) return "—";
  const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteIndex = ((midiNote % 12) + 12) % 12;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
};

const getRmsVolume = (samples: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
};

/* ------------------------------------------------------------------ */
/*  Gauge geometry helpers (computed once)                            */
/* ------------------------------------------------------------------ */

const GAUGE_CX = 260;
const GAUGE_CY = 260;
const R_TICK = 232;

const TICKS = (() => {
  const out: { x1: number; y1: number; x2: number; y2: number; long: boolean }[] = [];
  for (let deg = -150; deg <= 150; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const long = deg % 30 === 0;
    const ri = long ? 210 : 218;
    out.push({
      x1: GAUGE_CX + ri * Math.sin(rad),
      y1: GAUGE_CY - ri * Math.cos(rad),
      x2: GAUGE_CX + R_TICK * Math.sin(rad),
      y2: GAUGE_CY - R_TICK * Math.cos(rad),
      long,
    });
  }
  return out;
})();

const arcPath = (startDeg: number, endDeg: number, r: number) => {
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg * Math.PI) / 180;
  const x1 = GAUGE_CX + r * Math.sin(s);
  const y1 = GAUGE_CY - r * Math.cos(s);
  const x2 = GAUGE_CX + r * Math.sin(e);
  const y2 = GAUGE_CY - r * Math.cos(e);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
};

/* ------------------------------------------------------------------ */

export function ViolinTuner() {
  const [selectedInstrument] =
    useState<keyof typeof INSTRUMENT_PRESETS>("Violin");

  const [selectedNoteName, setSelectedNoteName] = useState<string>("G3");
  const [calibrationHz, setCalibrationHz] = useState<number>(440);
  const [inputSource, setInputSource] = useState<string>("Microphone (Default)");
  const [noiseFilter, setNoiseFilter] = useState<string>("Medium");
  const [pitchDetectionMode, setPitchDetectionMode] = useState<string>("Default");
  const [showNoteNames, setShowNoteNames] = useState<boolean>(true);
  const [showCenterIndicator, setShowCenterIndicator] = useState<boolean>(true);

  const smoothedPitchRef = useRef<number | null>(null);
  const lastStrongSignalTimeRef = useRef<number>(0);

  const [isActive, setIsActive] = useState<boolean>(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [message, setMessage] = useState<string>("Ready");
  const [, setAdvice] = useState<string>(
    "Play the open string and listen for a strong pitch."
  );
  const [droneOn, setDroneOn] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const droneOscRef = useRef<OscillatorNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  const droneCtxRef = useRef<AudioContext | null>(null);

  const tapIntervalRef = useRef<number | null>(null);
  const currentTapIntervalMsRef = useRef<number | null>(null);
  const lastTapSideRef = useRef<"flat" | "sharp" | null>(null);
  const wasInTuneRef = useRef<boolean>(false);

  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);

  const currentNotes = useMemo(() => {
    const preset =
      INSTRUMENT_PRESETS[selectedInstrument] ?? INSTRUMENT_PRESETS.Violin;
    const ratio = calibrationHz / 440;
    return preset.map((note) => ({
      name: note.name,
      frequency: note.frequency * ratio,
    }));
  }, [selectedInstrument, calibrationHz]);

  const selectedNote = useMemo(
    () =>
      currentNotes.find((note) => note.name === selectedNoteName) ??
      currentNotes[0],
    [currentNotes, selectedNoteName]
  );

  const detectedActualNote = useMemo(
    () => getNoteFromFrequency(detectedPitch),
    [detectedPitch]
  );

  const detector = useMemo(
    () =>
      new PitchDetector(
        2048,
        (inputLength: number) => new Float32Array(inputLength)
      ),
    []
  );

  // static waveform shape for the gauge center
  const waveBars = useMemo(
    () =>
      Array.from({ length: 41 }, (_, i) => {
        const t = (i - 20) / 20;
        return 6 + Math.cos(t * Math.PI) * 26 * (0.45 + Math.random() * 0.55);
      }),
    [selectedNoteName]
  );

  const clearTapFeedback = () => {
    if (tapIntervalRef.current !== null) {
      window.clearInterval(tapIntervalRef.current);
      tapIntervalRef.current = null;
    }
    currentTapIntervalMsRef.current = null;
    lastTapSideRef.current = null;
  };

  const autoDetectString = () => {
    if (!detectedPitch) {
      setMessage("Play a string first to auto-detect.");
      return;
    }
    const nearest = currentNotes.reduce(
      (closest, note) => {
        const diff = Math.abs(1200 * Math.log2(detectedPitch / note.frequency));
        return diff < closest.diff ? { note, diff } : closest;
      },
      { note: currentNotes[0], diff: Infinity as number }
    ).note;
    setSelectedNoteName(nearest.name);
    setMessage(`Auto-detected ${nearest.name}.`);
  };

  const stopAudio = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    clearTapFeedback();
    wasInTuneRef.current = false;
    smoothedPitchRef.current = null;
    lastStrongSignalTimeRef.current = 0;
    setDetectedPitch(null);
    setCents(null);
    setStatus("idle");
    setMessage("Ready");
  };

  const playInTuneChime = () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  };

  const playTap = () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    const tapOsc = audioContext.createOscillator();
    const tapGain = audioContext.createGain();
    tapOsc.type = "sine";
    tapOsc.frequency.value = 650;
    tapOsc.connect(tapGain);
    tapGain.connect(audioContext.destination);
    const now = audioContext.currentTime;
    tapOsc.start(now);
    tapGain.gain.setValueAtTime(0.0001, now);
    tapGain.gain.linearRampToValueAtTime(0.035, now + 0.005);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    tapOsc.stop(now + 0.06);
    tapOsc.onended = () => {
      tapOsc.disconnect();
      tapGain.disconnect();
    };
  };

  const updateBeat = (centsDiff: number) => {
    if (!audioContextRef.current) return;
    const absCents = Math.abs(centsDiff);
    if (absCents <= 5) {
      clearTapFeedback();
      if (!wasInTuneRef.current) {
        playInTuneChime();
        wasInTuneRef.current = true;
      }
      return;
    }
    wasInTuneRef.current = false;
    const side = centsDiff < 0 ? "flat" : "sharp";
    let intervalMs: number;
    if (side === "flat") {
      intervalMs = 1100 - Math.min(absCents, 50) * 9;
    } else {
      intervalMs = 450 - Math.min(absCents, 50) * 6;
    }
    intervalMs = Math.max(150, Math.round(intervalMs));
    const previousInterval = currentTapIntervalMsRef.current;
    const previousSide = lastTapSideRef.current;
    const intervalChanged =
      previousInterval === null || Math.abs(previousInterval - intervalMs) > 80;
    const sideChanged = previousSide !== side;
    if (!intervalChanged && !sideChanged) return;
    clearTapFeedback();
    currentTapIntervalMsRef.current = intervalMs;
    lastTapSideRef.current = side;
    playTap();
    tapIntervalRef.current = window.setInterval(playTap, intervalMs);
  };

  const updatePitch = () => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !audioContext || !dataArray) return;

    analyser.getFloatTimeDomainData(dataArray as any);
    const rmsVolume = getRmsVolume(dataArray);
    const [rawPitch, clarityValue] = detector.findPitch(
      dataArray as any,
      audioContext.sampleRate
    );

    const hasStrongSignal =
      rawPitch > 0 && clarityValue >= MIN_CLARITY && rmsVolume >= MIN_VOLUME_RMS;

    if (hasStrongSignal) {
      lastStrongSignalTimeRef.current = performance.now();
      const previousPitch = smoothedPitchRef.current;
      const smoothedPitch =
        previousPitch === null
          ? rawPitch
          : previousPitch + (rawPitch - previousPitch) * PITCH_SMOOTHING;
      smoothedPitchRef.current = smoothedPitch;

      const centsDiff = 1200 * Math.log2(smoothedPitch / selectedNote.frequency);
      const nextStatus = getStatus(centsDiff);
      setDetectedPitch(smoothedPitch);
      setCents(centsDiff);
      setStatus(nextStatus);
      setMessage(
        nextStatus === "in tune"
          ? "Locking in..."
          : `${nextStatus} by ${formatCents(centsDiff)}`
      );
      setAdvice(getTuningAdvice(centsDiff));
      updateBeat(centsDiff);
    } else {
      const elapsed = performance.now() - lastStrongSignalTimeRef.current;
      if (elapsed > NO_SIGNAL_DELAY_MS) {
        smoothedPitchRef.current = null;
        setDetectedPitch(null);
        setCents(null);
        setStatus("no signal");
        setMessage("No strong pitch detected");
        setAdvice(getTuningAdvice(null));
        clearTapFeedback();
        wasInTuneRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(updatePitch);
  };

  const startAudio = async () => {
    if (isActive) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("Microphone access is not available in this browser.");
      return;
    }
    try {
      const audioContext = new AudioContext();
      await audioContext.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyserNode);

      audioContextRef.current = audioContext;
      sourceRef.current = sourceNode;
      analyserRef.current = analyserNode;
      dataArrayRef.current = new Float32Array(analyserNode.fftSize);

      setIsActive(true);
      setStatus("listening");
      setMessage(`Listening for your ${selectedInstrument.toLowerCase()} note...`);
      rafRef.current = requestAnimationFrame(updatePitch);
    } catch (error) {
      setMessage("Could not access your microphone.");
      setStatus("idle");
    }
  };

  const stopTuner = () => {
    setIsActive(false);
    stopAudio();
  };

  const stopDrone = () => {
    if (droneOscRef.current) {
      try {
        droneOscRef.current.stop();
      } catch {}
      droneOscRef.current.disconnect();
      droneOscRef.current = null;
    }
    if (droneGainRef.current) {
      droneGainRef.current.disconnect();
      droneGainRef.current = null;
    }
    if (droneCtxRef.current) {
      droneCtxRef.current.close();
      droneCtxRef.current = null;
    }
    setDroneOn(false);
  };

  const toggleDrone = () => {
    if (droneOn) {
      stopDrone();
      return;
    }
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = selectedNote.frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    droneCtxRef.current = ctx;
    droneOscRef.current = osc;
    droneGainRef.current = gain;
    setDroneOn(true);
  };

  // keep the live drone pitch synced to the selected string
  useEffect(() => {
    if (droneOscRef.current && droneCtxRef.current) {
      droneOscRef.current.frequency.setValueAtTime(
        selectedNote.frequency,
        droneCtxRef.current.currentTime
      );
    }
  }, [selectedNote.frequency]);

  useEffect(() => {
    return () => {
      stopAudio();
      stopDrone();
    };
  }, []);

  const needleDeg = Math.max(-150, Math.min(150, (cents ?? 0) * 1.4));
  const needleRad = (needleDeg * Math.PI) / 180;
  const rNeedle = 224;
  const nx = GAUGE_CX + rNeedle * Math.sin(needleRad);
  const ny = GAUGE_CY - rNeedle * Math.cos(needleRad);

  const gaugeNote = detectedActualNote !== "—" ? detectedActualNote : selectedNote.name;
  const statusLabel = status === "idle" ? "IDLE" : status.toUpperCase();
  const statusClass = status.replace(" ", "-");

  return (
    <section className="tuner-screen">
      <div className="tuner-main">
        <div className="tuner-cols">
          {/* STRINGS */}
          <div className="card strings-card">
            <div className="card-title">STRINGS</div>

            <div className="string-list">
              {currentNotes.map((note) => (
                <button
                  key={note.name}
                  type="button"
                  className={`string-button ${
                    note.name === selectedNote.name ? "selected" : ""
                  }`}
                  onClick={() => setSelectedNoteName(note.name)}
                >
                  <span className="string-name">{note.name}</span>
                  <span className="string-hz">{note.frequency.toFixed(2)} Hz</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="auto-detect-button"
              onClick={autoDetectString}
            >
              Auto Detect
            </button>

            <div className="panel-status">
              <span className={`status-dot status-dot--${statusClass}`} />
              <span className="panel-status-text">
                {status === "idle" ? "Ready" : message}
              </span>
            </div>

            <div className="mic-controls">
              <button
                type="button"
                className="mic-start"
                onClick={startAudio}
                disabled={isActive}
              >
                Start Mic
              </button>
              <button
                type="button"
                className="mic-stop"
                onClick={stopTuner}
                disabled={!isActive}
              >
                Stop
              </button>
            </div>
          </div>

          {/* GAUGE */}
          <div className="gauge-col">
            <div className="gauge-shell">
              <svg viewBox="0 0 520 520" className="gauge-svg">
                <defs>
                  <linearGradient id="cyanArc" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1d9bd1" />
                    <stop offset="100%" stopColor="#39c8e6" />
                  </linearGradient>
                  <linearGradient id="purpArc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7c5cf0" />
                    <stop offset="100%" stopColor="#b34fe0" />
                  </linearGradient>
                  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="5" />
                  </filter>
                  <radialGradient id="dial" cx="50%" cy="42%" r="62%">
                    <stop offset="0%" stopColor="rgba(40,52,96,0.40)" />
                    <stop offset="60%" stopColor="rgba(18,24,50,0.25)" />
                    <stop offset="100%" stopColor="rgba(10,14,30,0)" />
                  </radialGradient>
                </defs>

                <circle cx={GAUGE_CX} cy={GAUGE_CY} r={244} fill="url(#dial)" />

                <path d={arcPath(-150, 150, R_TICK + 4)} fill="none" stroke="rgba(120,130,180,0.12)" strokeWidth="2" strokeLinecap="round" />

                <path d={arcPath(-150, -18, R_TICK + 4)} fill="none" stroke="url(#cyanArc)" strokeWidth="3.5" strokeLinecap="round" filter="url(#soft)" opacity="0.9" />
                <path d={arcPath(-150, -18, R_TICK + 4)} fill="none" stroke="url(#cyanArc)" strokeWidth="2.5" strokeLinecap="round" />
                <path d={arcPath(18, 150, R_TICK + 4)} fill="none" stroke="url(#purpArc)" strokeWidth="3.5" strokeLinecap="round" filter="url(#soft)" opacity="0.9" />
                <path d={arcPath(18, 150, R_TICK + 4)} fill="none" stroke="url(#purpArc)" strokeWidth="2.5" strokeLinecap="round" />

                {TICKS.map((t, i) => (
                  <line
                    key={i}
                    x1={t.x1}
                    y1={t.y1}
                    x2={t.x2}
                    y2={t.y2}
                    stroke={t.long ? "rgba(180,190,230,0.55)" : "rgba(150,160,200,0.28)"}
                    strokeWidth={t.long ? 2 : 1.3}
                    strokeLinecap="round"
                  />
                ))}

                <text x={GAUGE_CX - 138} y={GAUGE_CY + 24} className="gauge-mark-text">-50</text>
                <text x={GAUGE_CX + 112} y={GAUGE_CY + 24} className="gauge-mark-text">+50</text>
                <text x={GAUGE_CX} y={GAUGE_CY - 178} className="gauge-mark-text" textAnchor="middle">0</text>

                <g transform={`translate(${GAUGE_CX}, ${GAUGE_CY - 12})`}>
                  {waveBars.map((h, i) => (
                    <rect
                      key={i}
                      x={(i - 20) * 5.6 - 1.4}
                      y={-h}
                      width={2.8}
                      height={h * 2}
                      rx={1.4}
                      fill="rgba(150,140,235,0.55)"
                    />
                  ))}
                </g>

                <line x1={GAUGE_CX} y1={GAUGE_CY} x2={nx} y2={ny} stroke="rgba(235,238,255,0.85)" strokeWidth="2.5" strokeLinecap="round" className="gauge-needle-line" />
                <circle cx={nx} cy={ny} r={16} fill="rgba(180,180,255,0.18)" />
                <circle cx={nx} cy={ny} r={9} fill="#f3f5ff" className="gauge-needle-dot" />
                {showCenterIndicator && (
                  <circle cx={GAUGE_CX} cy={GAUGE_CY} r={4} fill="rgba(180,190,235,0.5)" />
                )}
              </svg>

              <div className="gauge-readout">
                <div className="gauge-note">{showNoteNames ? gaugeNote : "—"}</div>
                <div className="gauge-frequency">
                  {detectedPitch
                    ? `${detectedPitch.toFixed(2)} Hz`
                    : `${selectedNote.frequency.toFixed(2)} Hz`}
                </div>
                <div className={`gauge-status gauge-status--${statusClass}`}>
                  <span className="status-dot status-dot--listening" />
                  {statusLabel}
                </div>
              </div>
            </div>

            <div className="summary-card">
              <div className="summary-cell">
                <span className="summary-label">TARGET NOTE</span>
                <strong className="summary-big">{selectedNote.name}</strong>
              </div>
              <div className="summary-divider" />
              <div className="summary-cell">
                <span className="summary-label">DETECTED NOTE</span>
                <strong className="summary-big">{showNoteNames ? gaugeNote : "—"}</strong>
              </div>
              <div className="summary-divider" />
              <div className="summary-cell">
                <span className="summary-label">STATUS</span>
                <strong className={`summary-big summary-status--${statusClass}`}>
                  {statusLabel}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* DRONE */}
        <div className="card drone-card">
          <div className="drone-left">
            <div className="drone-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="12" x2="2" y2="12" />
                <line x1="6" y1="9" x2="6" y2="15" />
                <line x1="10" y1="5" x2="10" y2="19" />
                <line x1="14" y1="8" x2="14" y2="16" />
                <line x1="18" y1="10" x2="18" y2="14" />
                <line x1="22" y1="11" x2="22" y2="13" />
              </svg>
            </div>
            <div>
              <div className="drone-label">DRONE TONE</div>
              <div className="drone-frequency">{selectedNote.frequency.toFixed(0)} Hz</div>
            </div>
          </div>
          <button type="button" className="drone-play-button" onClick={toggleDrone}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
              {droneOn ? <rect x="6" y="5" width="12" height="14" rx="1" /> : <path d="M8 5v14l11-7z" />}
            </svg>
            {droneOn ? "Stop" : "Play"}
          </button>
        </div>
      </div>

      {/* SETTINGS PANEL */}
      <aside className="tuner-settings">
        <div className="settings-head">
          <h2>Tuner Settings</h2>
          <button type="button" className="settings-close" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-section-title">Calibration</div>

        <div className="field">
          <label>Reference Pitch</label>
          <div className="select-wrap">
            <select
              value={calibrationHz}
              onChange={(e) => setCalibrationHz(Number(e.target.value))}
            >
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
          <label>Input Source</label>
          <div className="select-wrap">
            <select value={inputSource} onChange={(e) => setInputSource(e.target.value)}>
              <option>Microphone (Default)</option>
              <option>External Audio Interface</option>
              <option>System Input</option>
            </select>
            <svg className="select-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="field">
          <label>Noise Filter</label>
          <div className="select-wrap">
            <select value={noiseFilter} onChange={(e) => setNoiseFilter(e.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
            <svg className="select-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="settings-divider" />

        <div className="settings-section-title">Advanced</div>

        <div className="field">
          <label>Pitch Detection</label>
          <div className="select-wrap">
            <select
              value={pitchDetectionMode}
              onChange={(e) => setPitchDetectionMode(e.target.value)}
            >
              <option>Default</option>
              <option>Fast</option>
              <option>Stable</option>
            </select>
            <svg className="select-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">Show Note Names</span>
          <button
            type="button"
            className={`toggle ${showNoteNames ? "on" : ""}`}
            onClick={() => setShowNoteNames((v) => !v)}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="toggle-row">
          <span className="toggle-label">Center Indicator</span>
          <button
            type="button"
            className={`toggle ${showCenterIndicator ? "on" : ""}`}
            onClick={() => setShowCenterIndicator((v) => !v)}
          >
            <span className="toggle-knob" />
          </button>
        </div>

        <div className="settings-spacer" />

        <button
          type="button"
          className="reset-btn"
          onClick={() => {
            setCalibrationHz(440);
            setInputSource("Microphone (Default)");
            setNoiseFilter("Medium");
            setPitchDetectionMode("Default");
            setShowNoteNames(true);
            setShowCenterIndicator(true);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reset to Defaults
        </button>
      </aside>
    </section>
  );
}