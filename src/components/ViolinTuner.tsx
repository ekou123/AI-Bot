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

    analyser.getFloatTimeDomainData(dataArray);
    const [pitch, clarityValue] = detector.findPitch(dataArray, audioContext.sampleRate);

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

  return (
    <section className="tuner-panel">
      <div className="tuner-header">
        <div>
          <h3>Violin Tuner</h3>
          <p className="tuner-subtitle">Mic input + pitch detection + voice and drone feedback.</p>
        </div>
        <div>
          <button className="tuner-btn tuner-start" onClick={startAudio} disabled={isActive}>
            Start
          </button>
          <button className="tuner-btn tuner-stop" onClick={stopTuner} disabled={!isActive}>
            Stop
          </button>
        </div>
      </div>

      <div className="tuner-options">
        {NOTE_TARGETS.map(note => (
          <button
            key={note.name}
            className={`tuner-note-button ${note.name === selectedNote.name ? "selected" : ""}`}
            onClick={() => setSelectedNote(note)}
            type="button"
          >
            {note.name}
          </button>
        ))}
      </div>

      <div className="tuner-status" style={{ borderColor: getStatusColor(status) }}>
        <div className="tuner-status-row">
          <span className="tuner-status-label">Target</span>
          <span>{selectedNote.name} · {selectedNote.frequency.toFixed(2)} Hz</span>
        </div>
        <div className="tuner-status-row">
          <span className="tuner-status-label">Detected</span>
          <span>{detectedPitch ? `${detectedPitch.toFixed(1)} Hz` : "—"}</span>
        </div>
        <div className="tuner-status-row">
          <span className="tuner-status-label">Deviation</span>
          <span>{cents !== null ? formatCents(cents) : "—"}</span>
        </div>
        <div className="tuner-status-row">
          <span className="tuner-status-label">Status</span>
          <span>{status}</span>
        </div>
        <div className="tuner-status-row">
          <span className="tuner-status-label">Advice</span>
          <span>{advice}</span>
        </div>
      </div>

      <div className="tuner-message">{message}</div>
    </section>
  );
}
