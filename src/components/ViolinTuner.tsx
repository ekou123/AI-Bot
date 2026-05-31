import { useEffect, useMemo, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

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
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
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
  if (cents === null) {
    return "Play the open string and listen for a strong pitch.";
  }

  const absCents = Math.abs(cents);

  if (absCents > 30) {
    return "Use the peg for a larger adjustment, then fine-tune with the tuner.";
  }

  if (absCents > 10) {
    return "Use the fine tuner for a stronger adjustment toward the target.";
  }

  if (absCents > 5) {
    return "Use the fine tuner gently to approach the target.";
  }

  return "String is nearly in tune — use the fine tuner to lock it in.";
};

const getNoteFromFrequency = (frequency: number | null) => {
  if (!frequency || frequency <= 0) {
    return "—";
  }

  const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440));
  const noteIndex = ((midiNote % 12) + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex];
  const octave = Math.floor(midiNote / 12) - 1;

  return `${noteName}${octave}`;
};

const getRmsVolume = (samples: Float32Array) => {
  let sum = 0;

  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }

  return Math.sqrt(sum / samples.length);
};

export function ViolinTuner() {
  

  const [selectedInstrument, setSelectedInstrument] =
    useState<keyof typeof INSTRUMENT_PRESETS>("Violin");

  const [selectedNoteName, setSelectedNoteName] = useState<string>("A4");
  const [calibrationHz, setCalibrationHz] = useState<number>(440);
  const [inputSource, setInputSource] = useState<string>("Microphone (Default)");
  const [noiseFilter, setNoiseFilter] = useState<string>("Medium");
  const [pitchDetectionMode, setPitchDetectionMode] =
    useState<string>("Default");
  const [showNoteNames, setShowNoteNames] = useState<boolean>(true);
  const [showCenterIndicator, setShowCenterIndicator] =
    useState<boolean>(true);
  const smoothedPitchRef = useRef<number | null>(null);
  const lastStrongSignalTimeRef = useRef<number>(0);

  const [isActive, setIsActive] = useState<boolean>(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [message, setMessage] = useState<string>("Ready");
  const [advice, setAdvice] = useState<string>(
    "Play the open string and listen for a strong pitch."
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

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
        const diff = Math.abs(
          1200 * Math.log2(detectedPitch / note.frequency)
        );

        return diff < closest.diff ? { note, diff } : closest;
      },
      {
        note: currentNotes[0],
        diff: Infinity as number,
      }
    ).note;

    setSelectedNoteName(nearest.name);
    setMessage(`Auto-detected ${nearest.name}.`);
  };

  const stopAudio = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }

    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
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

    if (!intervalChanged && !sideChanged) {
      return;
    }

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
      rawPitch > 0 &&
      clarityValue >= MIN_CLARITY &&
      rmsVolume >= MIN_VOLUME_RMS;

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
      const nextAdvice = getTuningAdvice(centsDiff);

      setDetectedPitch(smoothedPitch);
      setCents(centsDiff);
      setStatus(nextStatus);
      setMessage(
        nextStatus === "in tune"
          ? "Locking in..."
          : `${nextStatus} by ${formatCents(centsDiff)}`
      );
      setAdvice(nextAdvice);

      updateBeat(centsDiff);
    } else {
      const timeSinceLastStrongSignal =
        performance.now() - lastStrongSignalTimeRef.current;

      if (timeSinceLastStrongSignal > NO_SIGNAL_DELAY_MS) {
        smoothedPitchRef.current = null;

        const nextAdvice = getTuningAdvice(null);

        setDetectedPitch(null);
        setCents(null);
        setStatus("no signal");
        setMessage("No strong pitch detected");
        setAdvice(nextAdvice);

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
      setMessage(
        `Listening for your ${selectedInstrument.toLowerCase()} note...`
      );

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

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  useEffect(() => {
    setSelectedNoteName(
      INSTRUMENT_PRESETS[selectedInstrument]?.[0]?.name ?? "A4"
    );
  }, [selectedInstrument]);

  return (
    <section className="tuner-panel">
      <div className="tuner-header">
        <div className="tuner-header-copy">
          <p className="tuner-small-label">Instrument Tuner</p>
          <h1 className="tuner-main-title">{selectedInstrument} Tuner</h1>
          <p className="tuner-subtitle">
            Professional tuning for any instrument.
          </p>
        </div>

        <div className="tuner-header-actions">
          <button
            className="tuner-btn tuner-start"
            onClick={startAudio}
            disabled={isActive}
          >
            Start
          </button>

          <button
            className="tuner-btn tuner-stop"
            onClick={stopTuner}
            disabled={!isActive}
          >
            Stop
          </button>
        </div>
      </div>

      <div className="tuner-instrument-tabs">
        {[
          { label: "Violin", icon: "🎻" },
          { label: "Viola", icon: "🎻" },
          { label: "Cello", icon: "🎻" },
          { label: "Guitar", icon: "🎸" },
          { label: "Ukulele", icon: "🪕" },
          { label: "Mandolin", icon: "🎵" },
          { label: "Bass", icon: "🎸" },
          { label: "Custom", icon: "+" },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            className={`instrument-tab ${
              item.label === selectedInstrument ? "active" : ""
            }`}
            onClick={() =>
              setSelectedInstrument(
                item.label as keyof typeof INSTRUMENT_PRESETS
              )
            }
          >
            <span className="instrument-tab-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="tuner-grid">
        <div className="tuner-card tuner-left-card">
          <div className="card-title">String</div>

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
                <span>{note.name}</span>
                <span>{note.frequency.toFixed(2)} Hz</span>
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
            <span
              className={`status-dot status-dot--${status.replace(" ", "-")}`}
            />

            <div>
              <div className="status-label">Status</div>
              <div className="status-value">
                {status === "idle" ? "Ready" : message}
              </div>
            </div>
          </div>
        </div>

        <div className="tuner-card tuner-center-card">
          <div className="gauge-card">
            <div className="gauge-shell">
              <div className="gauge-arc" />
              <div className="gauge-arc gauge-arc--inner" />

              <div className="gauge-mark gauge-mark--left">-50</div>
              <div className="gauge-mark gauge-mark--center">0</div>
              <div className="gauge-mark gauge-mark--right">+50</div>

              <div
                className="gauge-needle"
                style={{
                  transform: `rotate(${Math.max(
                    -50,
                    Math.min(50, (cents ?? 0) * 1.2)
                  )}deg)`,
                }}
              />

              {showCenterIndicator && <div className="gauge-center" />}
            </div>

            <div className="gauge-readout">
              <div className="gauge-note">
                {showNoteNames ? detectedActualNote : "—"}
              </div>

              <div className="gauge-frequency">
                {detectedPitch
                  ? `${detectedPitch.toFixed(1)} Hz`
                  : `${selectedNote.frequency.toFixed(1)} Hz`}
              </div>

              <div
                className={`gauge-status gauge-status--${status.replace(
                  " ",
                  "-"
                )}`}
              >
                {status}
              </div>
            </div>

            <div className="gauge-footer">
              <div className="gauge-deviation">
                {cents !== null ? formatCents(cents) : "—"}
              </div>

              <div className="gauge-message">{message}</div>
              <div className="gauge-advice">{advice}</div>
            </div>

            <div className="tuner-summary-grid">
              <div className="summary-card">
                <span className="summary-label">Target Note</span>
                <strong>{selectedNote.name}</strong>
              </div>

              <div className="summary-card">
                <span className="summary-label">Selected Note</span>
                <strong>
                  {selectedNote.name} · {selectedNote.frequency.toFixed(2)} Hz
                </strong>
              </div>

              <div className="summary-card">
                <span className="summary-label">Status</span>
                <strong
                  className={`summary-status summary-status--${status.replace(
                    " ",
                    "-"
                  )}`}
                >
                  {status}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="tuner-card tuner-right-card settings-card">
          <div className="card-title">Tuner Settings</div>

          <div className="detail-group">
            <label className="detail-label">Calibration</label>
            <select
              className="detail-select"
              value={calibrationHz}
              onChange={(event) => setCalibrationHz(Number(event.target.value))}
            >
              <option value={432}>A4 = 432 Hz</option>
              <option value={440}>A4 = 440 Hz</option>
              <option value={442}>A4 = 442 Hz</option>
              <option value={444}>A4 = 444 Hz</option>
            </select>
          </div>

          <div className="detail-group">
            <label className="detail-label">Input Source</label>
            <select
              className="detail-select"
              value={inputSource}
              onChange={(event) => setInputSource(event.target.value)}
            >
              <option>Microphone (Default)</option>
              <option>External Audio Interface</option>
              <option>System Input</option>
            </select>
          </div>

          <div className="detail-group">
            <label className="detail-label">Noise Filter</label>
            <select
              className="detail-select"
              value={noiseFilter}
              onChange={(event) => setNoiseFilter(event.target.value)}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <div className="section-title">Advanced</div>

            <div className="detail-group">
              <label className="detail-label">Pitch Detection</label>
              <select
                className="detail-select"
                value={pitchDetectionMode}
                onChange={(event) => setPitchDetectionMode(event.target.value)}
              >
                <option>Default</option>
                <option>Fast</option>
                <option>Stable</option>
              </select>
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">Show Note Names</div>
                <div className="toggle-description">
                  Display active note names on the tuner readout.
                </div>
              </div>

              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showNoteNames}
                  onChange={() => setShowNoteNames((value) => !value)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="toggle-row">
              <div>
                <div className="toggle-label">Center Indicator</div>
                <div className="toggle-description">
                  Highlight the tuning center for easier alignment.
                </div>
              </div>

              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showCenterIndicator}
                  onChange={() => setShowCenterIndicator((value) => !value)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <button
              type="button"
              className="settings-reset"
              onClick={() => {
                setCalibrationHz(440);
                setInputSource("Microphone (Default)");
                setNoiseFilter("Medium");
                setPitchDetectionMode("Default");
                setShowNoteNames(true);
                setShowCenterIndicator(true);
              }}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </div>

      <div className="tuner-card tuner-bottom-card">
        <div className="drone-card">
          <div>
            <div className="drone-label">Drone Tone</div>
            <div className="drone-frequency">
              {selectedNote.frequency.toFixed(0)} Hz
            </div>
          </div>

          <button type="button" className="drone-play-button">
            Play
          </button>
        </div>
      </div>
    </section>
  );
}