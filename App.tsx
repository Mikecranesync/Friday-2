
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, ToolCallLog } from './types';
import { SYSTEM_INSTRUCTION, TOOLS } from './constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, blobToBase64 } from './utils/audioUtils';
import * as mockTools from './services/mockTools';
import { GmailService } from './services/gmail';
import Waveform from './components/Waveform';
import ToolsLog from './components/ToolsLog';
import LoginScreen from './components/LoginScreen';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Upload, LogOut, Mail, CheckCircle, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(false);
  const [toolLogs, setToolLogs] = useState<ToolCallLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Voice Activity State
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // Refs for Audio/Video
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Refs for Gemini Live
  const sessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Voice Activity Ref to prevent excessive re-renders
  const isUserSpeakingRef = useRef(false);
  
  // Analyser for Visualization
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);

  // Video Streaming Interval
  const frameIntervalRef = useRef<number | null>(null);

  // Init Gmail Service
  useEffect(() => {
    // Attempt to initialize Gmail service if scripts are loaded
    const timer = setTimeout(() => {
        GmailService.getInstance().init((token) => {
            setGmailConnected(true);
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleConnectGmail = () => {
    GmailService.getInstance().login();
  };

  // Initialize Audio Contexts
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256; 
      analyser.connect(audioContextRef.current.destination); 
      setOutputAnalyser(analyser);
    }
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const analyser = inputAudioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      setInputAnalyser(analyser);
    }
  }, []);

  // Connect to Gemini
  const connect = async () => {
    if (!process.env.API_KEY) {
      setError("API Key not found in environment.");
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      initAudio();

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: TOOLS }],
        },
        callbacks: {
          onopen: async () => {
            setConnectionState(ConnectionState.CONNECTED);
            setError(null);
            console.log("Session Opened");
            
            // Start Mic Stream immediately upon connection
            startMic();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current && outputAnalyser) {
              const ctx = audioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                base64ToUint8Array(base64Audio),
                ctx,
                24000
              );

              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAnalyser); // Visualizer
              // outputAnalyser is already connected to destination in initAudio, but connecting source to it works
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              console.log("Interrupted");
              sourcesRef.current.forEach(source => {
                source.stop();
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle Tool Calls
            if (message.toolCall) {
              handleToolCall(message.toolCall, sessionPromise);
            }
          },
          onclose: () => {
            console.log("Session Closed");
            setConnectionState(ConnectionState.DISCONNECTED);
            stopEverything();
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setConnectionState(ConnectionState.ERROR);
            setError("Connection Error. Please check console.");
            stopEverything();
          }
        }
      });

      sessionRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setConnectionState(ConnectionState.ERROR);
      setError("Failed to connect.");
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      if (inputAudioContextRef.current && inputAnalyser) {
        const ctx = inputAudioContextRef.current;
        const source = ctx.createMediaStreamSource(stream);
        inputSourceRef.current = source;
        
        // Connect to analyser for visual
        source.connect(inputAnalyser);

        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!isMicOn) return; // Software mute
          
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Calculate RMS for Voice Activity Detection
          let sum = 0;
          for(let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          
          // Threshold for "speaking"
          const isSpeaking = rms > 0.02; 
          
          if (isSpeaking !== isUserSpeakingRef.current) {
              isUserSpeakingRef.current = isSpeaking;
              setIsUserSpeaking(isSpeaking);
          }

          const pcmBlob = createPcmBlob(inputData);
          
          if (sessionRef.current) {
            sessionRef.current.then(session => {
              session.sendRealtimeInput({ media: pcmBlob });
            }).catch(e => console.error("Send Error", e));
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
      }
    } catch (err) {
      console.error("Mic Error", err);
      setError("Microphone access denied.");
    }
  };

  const handleToolCall = async (toolCall: any, sessionPromise: Promise<any>) => {
    const functionCalls = toolCall.functionCalls;
    if (!functionCalls) return;

    for (const call of functionCalls) {
      const log: ToolCallLog = {
        id: call.id,
        name: call.name,
        args: call.args,
        timestamp: Date.now(),
      };
      setToolLogs(prev => [...prev, log]);

      let result = {};
      const gmailService = GmailService.getInstance();
      
      try {
        if (call.name === 'listEmails') {
          if (gmailConnected) {
             result = await gmailService.listEmails(call.args.count);
          } else {
             result = await mockTools.listEmails(call.args.count);
          }
        } else if (call.name === 'searchInternet') {
          result = await mockTools.searchInternet(call.args.query);
        } else if (call.name === 'sendEmail') {
          if (gmailConnected) {
             result = await gmailService.sendEmail(call.args.to, call.args.subject, call.args.body);
          } else {
             result = await mockTools.sendEmail(call.args.to, call.args.subject, call.args.body);
          }
        }
      } catch (e: any) {
        console.error(e);
        result = { error: 'Function execution failed', details: e.message };
      }

      // Update log with result
      setToolLogs(prev => prev.map(l => l.id === call.id ? { ...l, result } : l));

      sessionPromise.then(session => {
        session.sendToolResponse({
          functionResponses: {
            id: call.id,
            name: call.name,
            response: { result },
          }
        });
      });
    }
  };

  const stopEverything = () => {
    // Stop Mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    
    setIsUserSpeaking(false);
    isUserSpeakingRef.current = false;

    // Stop Video
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // Stop Output
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => {
          if(session.close) session.close();
      });
    }
    setConnectionState(ConnectionState.DISCONNECTED);
    stopEverything();
  };

  // Video Streaming Logic
  const startVideo = async () => {
    try {
      setIsCamOn(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Start sending frames
      frameIntervalRef.current = window.setInterval(() => {
        sendVideoFrame();
      }, 1000 / 2); // 2 FPS is enough for context usually, helps bandwidth
    } catch (e) {
      console.error("Camera Error", e);
      setIsCamOn(false);
    }
  };

  const stopVideo = () => {
    setIsCamOn(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const sendVideoFrame = async () => {
    if (!canvasRef.current || !videoRef.current || !sessionRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];
    
    sessionRef.current.then(session => {
        session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64
            }
        });
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionRef.current) return;

    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            sessionRef.current!.then(session => {
                 session.sendRealtimeInput({
                    media: {
                        mimeType: file.type,
                        data: base64
                    }
                });
                // Provide a text hint to the model about what was uploaded
                session.sendRealtimeInput({
                    text: `[User uploaded a file: ${file.name}]`
                });
            });
        };
        reader.readAsDataURL(file);
    } else {
        alert("Currently only images and PDFs are supported.");
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Toggle handlers
  const toggleMic = () => setIsMicOn(!isMicOn);
  const toggleCam = () => {
    if (isCamOn) stopVideo();
    else startVideo();
  };

  const handleLogout = () => {
    disconnect();
    setIsAuthenticated(false);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEverything();
    };
  }, []);

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center relative overflow-hidden font-space">
      
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl p-6 flex flex-col items-center">
        
        {/* Header */}
        <div className="mb-8 text-center relative w-full">
           <div className="absolute top-0 right-0 flex items-center gap-2">
              {!gmailConnected ? (
                 <button
                    onClick={handleConnectGmail}
                    className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-800/50 rounded-full border border-slate-700 hover:border-cyan-500"
                    title="Connect Gmail"
                 >
                    <Mail size={18} />
                 </button>
              ) : (
                 <div className="p-2 text-green-500 bg-green-900/20 rounded-full border border-green-900/50" title="Gmail Connected">
                    <CheckCircle size={18} />
                 </div>
              )}
              <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Logout"
              >
                  <LogOut size={20} />
              </button>
           </div>

          <h1 className="text-5xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
            FRIDAY
          </h1>
          <p className="text-slate-400 text-sm tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'bg-slate-600'}`}></span>
            {connectionState === ConnectionState.CONNECTED 
              ? (isUserSpeaking ? "LISTENING..." : "ONLINE") 
              : connectionState}
          </p>
        </div>

        {/* Visualizer Area */}
        <div className={`relative w-full h-64 md:h-80 bg-slate-800/50 rounded-3xl border ${isUserSpeaking ? 'border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.3)]' : 'border-slate-700/50'} backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-2xl transition-all duration-300 mb-8`}>
            
            {/* The Waveform */}
            <div className="absolute inset-0 w-full h-full z-10 opacity-80">
                <Waveform 
                    analyser={connectionState === ConnectionState.CONNECTED ? (isUserSpeaking ? inputAnalyser : outputAnalyser) : null} 
                    isActive={connectionState === ConnectionState.CONNECTED}
                    color={isUserSpeaking ? '#22d3ee' : '#818cf8'} 
                />
            </div>
            
            {/* Video Preview (Overlay if active) */}
            <video 
                ref={videoRef} 
                className={`absolute right-4 bottom-4 w-32 h-24 object-cover rounded-lg border-2 border-cyan-500/30 z-20 transition-opacity duration-500 ${isCamOn ? 'opacity-100' : 'opacity-0'}`} 
                muted 
                playsInline
            />
            
            {/* Start Button (If disconnected) */}
            {connectionState === ConnectionState.DISCONNECTED && (
                <button 
                    onClick={connect}
                    className="relative z-30 group px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-full transition-all duration-300 shadow-[0_0_40px_-10px_rgba(34,211,238,0.5)] hover:shadow-[0_0_60px_-10px_rgba(34,211,238,0.7)]"
                >
                    <span className="flex items-center gap-2">
                        <Mic size={24} /> INITIALIZE SYSTEMS
                    </span>
                </button>
            )}

            {/* Connecting State */}
            {connectionState === ConnectionState.CONNECTING && (
                 <div className="flex flex-col items-center gap-4 z-30">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-cyan-400 tracking-widest">ESTABLISHING UPLINK...</span>
                 </div>
            )}
            
            {/* Error State */}
            {connectionState === ConnectionState.ERROR && (
                <div className="z-30 text-red-500 text-center px-4">
                    <div className="flex justify-center mb-2"><AlertCircle /></div>
                    <p className="font-bold mb-4">{error}</p>
                    <button onClick={() => setConnectionState(ConnectionState.DISCONNECTED)} className="px-4 py-2 bg-red-900/50 border border-red-500 rounded hover:bg-red-800/50">
                        RESET
                    </button>
                </div>
            )}
        </div>

        {/* Controls */}
        <div className={`flex items-center gap-6 transition-all duration-500 ${connectionState === ConnectionState.CONNECTED ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-10 pointer-events-none'}`}>
            
            {/* File Upload */}
            <div className="relative group">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden" 
                    accept="image/*,application/pdf"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-600 transition-colors"
                >
                    <Upload size={24} />
                </button>
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700 text-gray-300">
                    Upload Image/PDF
                </span>
            </div>

            {/* Mic Toggle */}
            <button 
                onClick={toggleMic}
                className={`p-6 rounded-full transition-all duration-300 ${isMicOn ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 scale-110' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}
            >
                {isMicOn ? <Mic size={32} /> : <MicOff size={32} />}
            </button>

            {/* Camera Toggle */}
            <button 
                onClick={toggleCam}
                className={`p-4 rounded-full transition-all duration-300 border ${isCamOn ? 'bg-slate-800 text-cyan-400 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-slate-800 text-slate-400 border-slate-600 hover:bg-slate-700'}`}
            >
                {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            
            {/* End Call */}
            <button 
                onClick={disconnect}
                className="p-4 rounded-full bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 transition-colors"
            >
                <PhoneOff size={24} />
            </button>

        </div>

        {/* Hidden Canvas for Video Processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Tool Logs Overlay */}
        <ToolsLog logs={toolLogs} />

      </div>
    </div>
  );
};

export default App;
