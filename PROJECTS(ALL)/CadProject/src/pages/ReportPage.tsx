import React, { useState, useRef, useCallback } from 'react';
import {
  AlertTriangle, MapPin, Upload, Mic, MicOff, X, CheckCircle,
  Play, Pause, Camera, Shield, Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateIncidentId } from '../services/mockApi';
import type { Incident, EmergencyType, MediaFile, Priority, AIAnalysis } from '../types';
import { generateId } from '../utils/helpers';

const EMERGENCY_TYPES: EmergencyType[] = ['Accident', 'Medical', 'Fire', 'Natural Disaster', 'Crime', 'Other'];

const TYPE_COLORS: Record<EmergencyType, string> = {
  Accident: 'text-orange-400',
  Medical: 'text-red-400',
  Fire: 'text-orange-500',
  'Natural Disaster': 'text-blue-400',
  Crime: 'text-purple-400',
  Other: 'text-white/60',
};

const TYPE_ICONS: Record<EmergencyType, string> = {
  Accident: '🚗', Medical: '🚑', Fire: '🔥',
  'Natural Disaster': '🌊', Crime: '🚔', Other: '⚠️',
};

function getPriorityFromType(type: EmergencyType): Priority {
  if (type === 'Medical' || type === 'Fire') return 'Critical';
  if (type === 'Accident' || type === 'Crime' || type === 'Natural Disaster') return 'High';
  return 'Medium';
}

function generateAIAnalysis(type: EmergencyType): AIAnalysis {
  const configs: Record<EmergencyType, Partial<AIAnalysis>> = {
    Medical: { severity: 85, confidence: 89, detectedHazards: ['Medical Emergency', 'Possible Critical Condition'], recommendedResponse: 'Dispatch ALS ambulance immediately.', resourcesNeeded: ['ALS Ambulance', 'Medical Team'] },
    Fire: { severity: 90, confidence: 88, detectedHazards: ['Active Fire', 'Smoke Inhalation Risk'], recommendedResponse: 'Deploy fire suppression teams and establish evacuation zone.', resourcesNeeded: ['Fire Engine', 'Ladder Truck', 'Hazmat'] },
    Accident: { severity: 65, confidence: 82, detectedHazards: ['Vehicle Collision', 'Traffic Hazard'], recommendedResponse: 'Send BLS ambulance and traffic police.', resourcesNeeded: ['BLS Ambulance', 'Traffic Police'] },
    'Natural Disaster': { severity: 80, confidence: 78, detectedHazards: ['Environmental Hazard', 'Possible Displacement'], recommendedResponse: 'Coordinate emergency shelter and rescue teams.', resourcesNeeded: ['Rescue Teams', 'Emergency Shelter'] },
    Crime: { severity: 70, confidence: 80, detectedHazards: ['Public Safety Threat', 'Potential Weapons'], recommendedResponse: 'Dispatch patrol units to secure the area.', resourcesNeeded: ['Patrol Units', 'Detective Unit'] },
    Other: { severity: 40, confidence: 65, detectedHazards: ['Unknown Threat'], recommendedResponse: 'Send assessment team for evaluation.', resourcesNeeded: ['Assessment Team'] },
  };
  const config = configs[type];
  return {
    severity: config.severity!,
    confidence: config.confidence!,
    detectedHazards: config.detectedHazards!,
    recommendedResponse: config.recommendedResponse!,
    estimatedResponseTime: `${Math.floor(Math.random() * 8) + 3}-${Math.floor(Math.random() * 5) + 8} minutes`,
    resourcesNeeded: config.resourcesNeeded!,
    summary: `Incident analysis complete. Severity score: ${config.severity}%. Priority response recommended.`,
    generatedAt: new Date().toISOString(),
  };
}

export default function ReportPage() {
  const { addIncident, addNotification } = useApp();

  // Form state
  const [type, setType] = useState<EmergencyType>('Medical');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [locating, setLocating] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [recording, setRecording] = useState(false);
  const [, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedId, setConfirmedId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Geolocation
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      addNotification({ type: 'error', message: 'Geolocation is not supported by your browser.' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAddress(`${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°W (GPS)`);
        setLocating(false);
        addNotification({ type: 'success', message: 'Location captured from device GPS.' });
      },
      () => {
        setLocating(false);
        addNotification({ type: 'warning', message: 'Could not get GPS location. Please enter address manually.' });
      }
    );
  }, [addNotification]);

  // File upload
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newFiles: MediaFile[] = files.map(f => ({
      id: generateId(),
      name: f.name,
      type: f.type.startsWith('image') ? 'image' : f.type.startsWith('video') ? 'video' : 'audio',
      url: URL.createObjectURL(f),
      size: f.size,
    }));
    setMediaFiles(prev => [...prev, ...newFiles].slice(0, 5));
  }, []);

  const removeFile = useCallback((id: string) => {
    setMediaFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true);
    } catch {
      addNotification({ type: 'error', message: 'Microphone access denied. Please allow microphone access.' });
    }
  }, [addNotification]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing, audioUrl]);

  // Validation
  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!description.trim() || description.trim().length < 20) {
      errs.description = 'Please provide a detailed description (at least 20 characters).';
    }
    if (!address.trim() && !lat) {
      errs.location = 'Please provide a location or use "Get Current Location".';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [description, address, lat]);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitting(true);

    const id = generateIncidentId();
    const now = new Date().toISOString();
    const priority = getPriorityFromType(type);

    const incident: Incident = {
      id,
      type,
      description,
      location: {
        lat: lat ? parseFloat(lat) : 40.7128,
        lng: lng ? parseFloat(lng) : -74.006,
        address: address || 'Location not specified',
      },
      priority,
      status: priority === 'Critical' ? 'Critical' : 'Active',
      createdAt: now,
      updatedAt: now,
      reportedBy: 'Portal User',
      media: mediaFiles,
      assignedAgents: ['Intake Agent', 'AI Analysis Agent', 'Decision Engine'],
      aiAnalysis: generateAIAnalysis(type),
      timeline: [
        { id: generateId(), timestamp: now, event: 'Incident registered via emergency portal', agent: 'Intake Agent', type: 'info' },
        { id: generateId(), timestamp: now, event: 'Automated triage and AI analysis initiated', agent: 'AI Analysis Agent', type: 'info' },
        { id: generateId(), timestamp: now, event: 'Incident logged to central dispatch queue', agent: 'Decision Engine', type: 'success' },
      ],
    };

    await addIncident(incident);
    setConfirmedId(id);
    setShowConfirm(true);
    setSubmitting(false);
  }, [validate, type, description, address, lat, lng, mediaFiles, addIncident]);

  const handleReset = useCallback(() => {
    setType('Medical');
    setDescription('');
    setAddress('');
    setLat('');
    setLng('');
    setMediaFiles([]);
    setAudioBlob(null);
    setAudioUrl(null);
    setShowConfirm(false);
    setConfirmedId('');
    setErrors({});
  }, []);

  if (showConfirm) {
    return <ConfirmationScreen id={confirmedId} type={type} onReset={handleReset} />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">New Emergency Report</h2>
            <p className="text-xs text-white/40">Direct priority routing to multi-agent emergency dispatch</p>
          </div>
        </div>

        {/* Emergency Type */}
        <div>
          <label className="label">Emergency Type *</label>
          <div className="grid grid-cols-3 gap-2.5">
            {EMERGENCY_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                  type === t
                    ? 'bg-red-500/15 border-red-500/40 shadow-[0_0_12px_rgba(229,9,20,0.1)]'
                    : 'bg-black-300 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="text-xl mb-1">{TYPE_ICONS[t]}</div>
                <div className={`text-xs font-semibold ${type === t ? TYPE_COLORS[t] : 'text-white/70'}`}>{t}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label">Incident Description *</label>
          <textarea
            className={`input-field resize-none h-32 ${errors.description ? 'border-red-500/60' : ''}`}
            placeholder="Describe the emergency in detail — what happened, how many people involved, immediate dangers, etc."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex justify-between mt-1">
            {errors.description && <span className="text-xs text-red-400">{errors.description}</span>}
            <span className={`text-xs ml-auto ${description.length < 20 ? 'text-white/30' : 'text-green-400'}`}>
              {description.length} chars
            </span>
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="label">Location *</label>
          <div className="space-y-3">
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                className={`input-field pl-9 ${errors.location ? 'border-red-500/60' : ''}`}
                placeholder="Street address or landmark"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                className="input-field"
                placeholder="Latitude (optional)"
                value={lat}
                onChange={e => setLat(e.target.value)}
                step="0.000001"
              />
              <input
                type="number"
                className="input-field"
                placeholder="Longitude (optional)"
                value={lng}
                onChange={e => setLng(e.target.value)}
                step="0.000001"
              />
            </div>
            <button
              onClick={handleGetLocation}
              disabled={locating}
              className="btn-secondary w-full justify-center text-sm"
            >
              {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} className="text-red-400" />}
              {locating ? 'Locating...' : 'Use Current Location (GPS)'}
            </button>
            {errors.location && <span className="text-xs text-red-400">{errors.location}</span>}
          </div>
        </div>

        {/* Media Upload */}
        <div>
          <label className="label">Evidence Upload (Optional)</label>
          <div
            className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-red-500/30 transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera size={28} className="text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/50">Click to upload images or videos</p>
            <p className="text-xs text-white/30 mt-1">Max 5 files · JPG, PNG, MP4</p>
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
          {mediaFiles.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {mediaFiles.map(f => (
                <div key={f.id} className="relative rounded-lg overflow-hidden bg-black-300 border border-white/10">
                  {f.type === 'image' ? (
                    <img src={f.url} alt={f.name} className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center">
                      <Upload size={24} className="text-white/40" />
                      <span className="text-xs text-white/40 ml-2">{f.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(f.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voice Recording */}
        <div>
          <label className="label">Voice Recording (Optional)</label>
          <div className="flex items-center gap-3">
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                recording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-black-300 border border-white/10 text-white/70 hover:border-white/20'
              }`}
            >
              {recording ? <MicOff size={15} /> : <Mic size={15} className="text-red-400" />}
              {recording ? 'Stop Recording' : 'Start Recording'}
            </button>
            {recording && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording...
              </div>
            )}
            {audioUrl && !recording && (
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={togglePlayback}
                  className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center"
                >
                  {playing ? <Pause size={13} className="text-green-400" /> : <Play size={13} className="text-green-400" />}
                </button>
                <div className="flex-1 h-1 bg-white/10 rounded-full">
                  <div className="h-full w-1/3 bg-green-400 rounded-full" />
                </div>
                <span className="text-xs text-green-400">Recording saved</span>
                <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
              </div>
            )}
          </div>
        </div>

        {/* Pre-submit Notice */}
        <div className="p-4 rounded-lg bg-black-300 border border-white/5">
          <div className="flex items-start gap-2">
            <Shield size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">
              By submitting, this incident report is transmitted to the AegisGrid Central Command dispatch network with prioritized multi-agent assessment.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.99] shadow-[0_0_20px_rgba(229,9,20,0.3)] hover:shadow-[0_0_30px_rgba(229,9,20,0.5)]"
        >
          {submitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Processing Report...
            </>
          ) : (
            <>
              <AlertTriangle size={20} />
              REPORT EMERGENCY
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ConfirmationScreen({ id, type, onReset }: { id: string; type: EmergencyType; onReset: () => void }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="glass-card p-8 text-center animate-fade-in">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Incident Logged Successfully</h2>
        <div className="font-mono text-2xl text-red-400 font-bold mb-4">{id}</div>

        <div className="mb-6 p-4 rounded-xl bg-black-300 border border-green-500/20 text-left">
          <div className="font-semibold text-green-400 text-sm mb-2 flex items-center gap-2">
            <CheckCircle size={15} />
            Triage & Dispatch Initiated
          </div>
          <ul className="text-xs text-white/60 space-y-1.5 leading-relaxed">
            <li>✓ Incident registered in central dispatch queue.</li>
            <li>✓ Multi-agent assessment units allocated.</li>
            <li>✓ Real-time tracking enabled in Incident Management.</li>
          </ul>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-sm px-2">
            <span className="text-white/50">Type</span>
            <span className="text-white font-medium">{type}</span>
          </div>
          <div className="flex items-center justify-between text-sm px-2">
            <span className="text-white/50">Status</span>
            <span className="status-badge badge-pending">Processing</span>
          </div>
          <div className="flex items-center justify-between text-sm px-2">
            <span className="text-white/50">Network Stream</span>
            <span className="text-green-400 text-xs">Active Grid Dispatch</span>
          </div>
        </div>

        <button onClick={onReset} className="btn-primary w-full justify-center">
          Submit Another Report
        </button>
      </div>
    </div>
  );
}
