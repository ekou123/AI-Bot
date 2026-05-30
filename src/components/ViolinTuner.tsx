import { useEffect, useMemo, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

type NoteTarget = {
  name: string;
  frequency: number;
};

const NOTE_TARGETS: NoteTarget[] = [
  { name: "G3", frequency: 196.0 },
  { name: "D4", frequency: 293.66 },
  { name: "A4", frequency: 440.0 },
  { name: "E5", frequency: 659.25 },
];

const formatCents = (value: number) => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}¢`;
};

const getStatus = (cents: number | null) => {
  if (cents === null) return "no signal";
  if (Math.abs(cents) <= 5) return "in tune";
  return cents > 0 ? "sharp" : "flat";
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "in tune":
      return "#22c55e";
    case "sharp":
      return "#f97316";
    case "flat":
      return "#ef4444";
    default:
      return "#64748b";
  }
};

const getTuningAdvice = (cents: number | null) => {
  if (cents === null) return "Play the open string and listen for a strong pitch.";
  const absCents = Math.abs(cents);
  if (absCents > 30) return "Use the peg for a larger adjustment, then fine-tune with the tuner.";
  if (absCents > 10) return "Use the fine tuner for a stronger adjustment toward the target.";
  if (absCents > 5) return "Use the fine tuner gently to approach the target.";
  return "String is nearly in tune — use the fine tuner to lock it in.";
};

const speakStatus = (message: string) => {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

export function ViolinTuner() {
  const [selectedNote, setSelectedNote] = useState<NoteTarget>(NOTE_TARGETS[2]);
  const [isActive, setIsActive] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<number | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [message, setMessage] = useState<string>("Ready");
  const [advice, setAdvice] = useState<string>("Play the open string and listen for a strong pitch.");

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Float32Array | null>(null);
  const lastVoiceRef = useRef<string>("");

  const detector = useMemo(
    () => new PitchDetector(2048, (inputLength: number) => new Float32Array(inputLength)),
    []
  );

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
    setDetectedPitch(null);
    setCents(null);
    setStatus("idle");
    setMessage("Ready");
  };

  useEffect(() => {
    return () => {
      stopAudio();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!isActive) return;
    if (!audioContextRef.current || !oscillatorRef.current) return;
    oscillatorRef.current.frequency.setTargetAtTime(selectedNote.frequency, audioContextRef.current.currentTime, 0.02);
  }, [selectedNote, isActive]);

  const updatePitch = () => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !audioContext || !dataArray) return;

    analyser.getFloatTimeDomainData(dataArray as any);
    const [pitch, clarityValue] = detector.findPitch(dataArray as any, audioContext.sampleRate);

    if (pitch > 0 && clarityValue > 0.1) {
      const centsDiff = 1200 * Math.log2(pitch / selectedNote.frequency);
      const nextStatus = getStatus(centsDiff);
      const nextAdvice = getTuningAdvice(centsDiff);
      setDetectedPitch(pitch);
      setCents(centsDiff);
      setStatus(nextStatus);
      setMessage(nextStatus === "in tune" ? "Locking in..." : `${nextStatus} by ${formatCents(centsDiff)}`);
      setAdvice(nextAdvice);

      const speakMessage = nextStatus === "in tune"
        ? `In tune ${selectedNote.name}. ${nextAdvice}`
        : `${nextStatus}. ${nextAdvice}`;

      if (speakMessage !== lastVoiceRef.current) {
        lastVoiceRef.current = speakMessage;
        speakStatus(speakMessage);
      }
    } else {
      const nextAdvice = getTuningAdvice(null);
      setDetectedPitch(null);
      setCents(null);
      setStatus("no signal");
      setMessage("No strong pitch detected");
      setAdvice(nextAdvice);
      if (lastVoiceRef.current !== "no signal") {
        lastVoiceRef.current = "no signal";
        speakStatus("Listening...");
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

    const audioContext = new AudioContext();
    await audioContext.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const sourceNode = audioContext.createMediaStreamSource(stream);
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;
    sourceNode.connect(analyserNode);

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = selectedNote.frequency;
    gainNode.gain.value = 0.05;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();

    audioContextRef.current = audioContext;
    sourceRef.current = sourceNode;
    analyserRef.current = analyserNode;
    oscillatorRef.current = oscillator;
    gainRef.current = gainNode;
    dataArrayRef.current = new Float32Array(analyserNode.fftSize);

    setIsActive(true);
    setStatus("listening");
    setMessage("Listening for your violin note...");
    lastVoiceRef.current = "";
    rafRef.current = requestAnimationFrame(updatePitch);
  };

  const stopTuner = () => {
    setIsActive(false);
    stopAudio();
  };

  const detectedNoteName = () => {
    if (cents === null) return "—";
    if (Math.abs(cents) <= 5) return selectedNote.name;
    return cents > 0 ? `${selectedNote.name} ♯` : `${selectedNote.name} ♭`;
  };

  return (
    <section className="tuner-panel">
      <div className="tuner-header">
        <div className="tuner-header-copy">
          <p className="tuner-small-label">Instrument Tuner</p>
          <h1 className="tuner-main-title">Violin Tuner</h1>
          <p className="tuner-subtitle">Professional tuning for any instrument.</p>
        </div>
        <div className="tuner-header-actions">
          <button className="tuner-btn tuner-start" onClick={startAudio} disabled={isActive}>
            Start
          </button>
          <button className="tuner-btn tuner-stop" onClick={stopTuner} disabled={!isActive}>
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
            className={`instrument-tab ${item.label === "Violin" ? "active" : ""}`}
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
            {NOTE_TARGETS.map((note) => (
              <button
                key={note.name}
                type="button"
                className={`string-button ${note.name === selectedNote.name ? "selected" : ""}`}
                onClick={() => setSelectedNote(note)}
              >
                <span>{note.name}</span>
                <span>{note.frequency.toFixed(2)} Hz</span>
              </button>
            ))}
          </div>
          <button type="button" className="auto-detect-button">
            Auto Detect
          </button>
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
                  transform: `rotate(${Math.max(-50, Math.min(50, (cents ?? 0) * 1.2))}deg)`,
                }}
              />
              <div className="gauge-center" />
            </div>

            <div className="gauge-readout">
              <div className="gauge-note">{selectedNote.name}</div>
              <div className="gauge-frequency">
                {detectedPitch ? `${detectedPitch.toFixed(1)} Hz` : `${selectedNote.frequency.toFixed(1)} Hz`}
              </div>
              <div className={`gauge-status gauge-status--${status.replace(" ", "-")}`}>
                {status}
              </div>
            </div>

            <div className="gauge-footer">
              <div className="gauge-deviation">{cents !== null ? formatCents(cents) : "—"}</div>
              <div className="gauge-message">{message}</div>
              <div className="gauge-advice">{advice}</div>
            </div>
          </div>
        </div>

        <div className="tuner-card tuner-right-card" style={{ borderColor: getStatusColor(status) }}>
          <div className="card-title">Details</div>
          <div className="detail-row">
            <span>Target Note</span>
            <span>{selectedNote.name}</span>
          </div>
          <div className="detail-row">
            <span>Detected Note</span>
            <span>{detectedNoteName()}</span>
          </div>
          <div className="detail-row">
            <span>Frequency</span>
            <span>{detectedPitch ? `${detectedPitch.toFixed(1)} Hz` : "—"}</span>
          </div>
          <div className="detail-row">
            <span>Deviation</span>
            <span>{cents !== null ? formatCents(cents) : "—"}</span>
          </div>
          <div className="detail-row">
            <span>Status</span>
            <span>{status}</span>
          </div>

          <div className="detail-group">
            <label className="detail-label">Calibration</label>
            <select className="detail-select">
              <option value="440">A4 = 440 Hz</option>
              <option value="442">A4 = 442 Hz</option>
            </select>
          </div>

          <div className="detail-group">
            <label className="detail-label">Input Source</label>
            <select className="detail-select">
              <option>Microphone (Default)</option>
            </select>
          </div>

          <div className="detail-group">
            <label className="detail-label">Noise Filter</label>
            <select className="detail-select">
              <option>Medium</option>
            </select>
          </div>
        </div>
      </div>

      <div className="tuner-card tuner-bottom-card">
        <div className="drone-card">
          <div>
            <div className="drone-label">Drone Tone</div>
            <div className="drone-frequency">{selectedNote.frequency.toFixed(0)} Hz</div>
          </div>
          <button type="button" className="drone-play-button">
            Play
          </button>
        </div>
      </div>
    </section>
  );
}
