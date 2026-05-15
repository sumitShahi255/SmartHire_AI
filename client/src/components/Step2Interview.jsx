import React from 'react'
import maleVideo from "../assets/Videos/male-ai.mp4"
import femaleVideo from "../assets/Videos/female-ai.mp4"
import Timer from './Timer';
import { motion } from "motion/react";
import { ArrowRight, Mic, MicOff } from "lucide-react";
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';
import axios from 'axios';
import { ServerUrl } from '../App';
import * as faceapi from '@vladmandic/face-api';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Camera, ShieldAlert, Video as VideoIcon, Download, Smartphone } from 'lucide-react';






function Step2Interview({interviewData, onFinish}) {
  const {interviewId, questions, userName} = interviewData;
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef("");
  const transcriptTimeoutRef = useRef(null);
  const [isIntroPhase, setIsIntroPhase] = useState(true);

  const [isMicOn, setIsMicOn] = useState(true);
  const recognitionRef = useRef(null);
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer,setAnswer] = useState("");
  const [feedback,setFeedback] = useState("");
  const [timeLeft,setTimeLeft] = useState(questions[0]?.timeLimit || 0);

  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender,setVoiceGender] = useState("female");
  const [subtitle,setSubtitle] = useState("");

  const videoRef = useRef(null);
  const userVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const analysisIntervalRef = useRef(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [emotion, setEmotion] = useState("Neutral");
  const [cheatingAlert, setCheatingAlert] = useState("");
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [warningCount, setWarningCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [statusAlert, setStatusAlert] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  const violationCounterRef = useRef({
    faceOut: 0,
    multiplePeople: 0,
    phone: 0
  });
  const objectModelRef = useRef(null);
  const statusAlertRef = useRef("");
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const snapshotsRef = useRef([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);






  const currentQuestion = questions[currentIndex];

  const handleCheatingRef = useRef(null);
  useEffect(() => {
    handleCheatingRef.current = (type) => {
      setWarningCount(prev => {
        const nextCount = prev + 1;
        if (nextCount >= 3) {
          setCheatingAlert("CRITICAL: 3 strikes reached. Ending interview automatically.");
          setTimeout(() => finishInterview(true), 2000);
        } else {
          setCheatingAlert(`Warning ${nextCount}/3: ${type} detected! Next time the interview will end.`);
        }
        
        setTimeout(() => setCheatingAlert(""), 3000);
        return nextCount;
      });
    };
  });

  // voice function

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if(!voices.length){
        return;
      }

      // female voice

      const femaleVoice = 
      voices.find(v => 
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('female')
      );

      if(femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        return;
      }

      // male voice

      const maleVoice = 
      voices.find(v => 
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('mark') ||
        v.name.toLowerCase().includes('male')
      );

      if(maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        return;
      }

      setSelectedVoice(voices[0]);
      setVoiceGender("female");
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

  },[])

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          // Load Object Detection Model
          (async () => {
            await tf.ready();
            objectModelRef.current = await cocoSsd.load();
            console.log("Object Detection Model (COCO-SSD) loaded!");
          })()
        ]);
        console.log("Face AI Models loaded successfully!");
        setIsModelsLoaded(true);
        setIsInitializing(false);
      } catch (err) {
        console.error("Failed to load AI models", err);
        setIsModelsLoaded(true);
        setIsInitializing(false);
      }
    };

    loadModels();
  }, []);
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            frameRate: 24
          },
          audio: false 
        });
        streamRef.current = stream;
        
        if (hasStarted && userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          if (!isRecording) startRecording(stream);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      stopRecording();
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    };
  }, [hasStarted]); 

  
  useEffect(() => {
    if (!hasStarted) return;
    
    const snapshotInterval = setInterval(() => {
      takeSnapshot();
    }, 30000);

    return () => clearInterval(snapshotInterval);
  }, [hasStarted]);

 
  

  useEffect(() => {
    if (!hasStarted) return;

    // Disable Copy, Paste, Cut, and Context Menu
    const preventDefaults = (e) => e.preventDefault();
    document.addEventListener('copy', preventDefaults);
    document.addEventListener('paste', preventDefaults);
    document.addEventListener('cut', preventDefaults);
    document.addEventListener('contextmenu', preventDefaults);

    // Block Keyboard Shortcuts
    const blockShortcuts = (e) => {
      const isCopyPaste = e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x');
      const isOtherForbidden = 
        e.key === 'F12' || 
        e.key === 'PrintScreen' || 
        (e.ctrlKey && (e.key === 'u' || e.key === 'i' || e.key === 'j')) ||
        e.altKey || 
        e.metaKey;

      if (isCopyPaste || isOtherForbidden) {
        e.preventDefault();
        if (isOtherForbidden) {
          handleCheatingRef.current?.("Forbidden shortcut");
        }
      }
    };
    document.addEventListener('keydown', blockShortcuts);

    
    const handleVisibilityChange = () => {
      if (document.hidden) handleCheatingRef.current?.("Tab switching");
    };
    const handleBlur = () => handleCheatingRef.current?.("Window focus lost");

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        if (hasStarted) handleCheatingRef.current?.("Exited full-screen");
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('copy', preventDefaults);
      document.removeEventListener('paste', preventDefaults);
      document.removeEventListener('cut', preventDefaults);
      document.removeEventListener('contextmenu', preventDefaults);
      document.removeEventListener('keydown', blockShortcuts);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted]);

  const startInterviewSession = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setHasStarted(true);
        
        setTimeout(() => takeSnapshot(), 2000);
      }
    } catch (err) {
      console.error("Fullscreen request failed", err);
      setHasStarted(true); 
      setTimeout(() => takeSnapshot(), 2000);
    }
  };

  const takeSnapshot = () => {
    if (userVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = userVideoRef.current.videoWidth;
      canvas.height = userVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(userVideoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      snapshotsRef.current = [...snapshotsRef.current.slice(-9), dataUrl];
      setSnapshots(snapshotsRef.current);
      
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-20 right-10 bg-black/80 text-white text-[10px] px-3 py-1 rounded-full z-[100] animate-pulse';
      toast.innerText = '📸 Snapshot Captured';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  useEffect(() => {
    console.log("AI Effect Check:", { isModelsLoaded, hasUserVideo: !!userVideoRef.current, hasStarted });
    if (isModelsLoaded && userVideoRef.current && hasStarted) {
      console.log("Starting AI Analysis Interval with delay...");
      const aiTimeout = setTimeout(() => {
        analysisIntervalRef.current = setInterval(async () => {
        if (!userVideoRef.current || userVideoRef.current.readyState !== 4) {
          console.log("Video not ready or null", userVideoRef.current?.readyState);
          return;
        }

        try {
          
          const detections = await faceapi.detectAllFaces(
            userVideoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
          ).withFaceLandmarks();

          console.log("AI Detections Count:", detections.length);

          if (detections.length > 1) {
            violationCounterRef.current.multiplePeople++;
            violationCounterRef.current.faceOut = 0; 
            if (statusAlertRef.current !== "Multiple faces detected. Please ensure only you are in the frame.") {
              statusAlertRef.current = "Multiple faces detected. Please ensure only you are in the frame.";
              setStatusAlert("Multiple faces detected. Please ensure only you are in the frame.");
            }
            if (violationCounterRef.current.multiplePeople >= 3) {
              handleCheatingRef.current?.("Multiple people");
              violationCounterRef.current.multiplePeople = 0;
            }
          } else if (detections.length === 0) {
            violationCounterRef.current.faceOut++;

            
            if (violationCounterRef.current.faceOut >= 3) {
              if (statusAlertRef.current !== "Face not detected. Please stay in the camera frame.") {
                statusAlertRef.current = "Face not detected. Please stay in the camera frame.";
                setStatusAlert("Face not detected. Please stay in the camera frame.");
              }
              if (isFaceDetected) setIsFaceDetected(false);
            }

            if (violationCounterRef.current.faceOut >= 20) {
              setCheatingAlert("Interview ended due to prolonged face absence.");
              setTimeout(() => finishInterview(true), 2000);
              if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
            }
          } else {
            
            if (!isFaceDetected) setIsFaceDetected(true);
            violationCounterRef.current.faceOut = 0;
            violationCounterRef.current.multiplePeople = 0;

            
            if (statusAlertRef.current !== "") {
              statusAlertRef.current = "";
              setStatusAlert("");
            }
          }

          //  Phone Detection 
          if (objectModelRef.current) {
            const predictions = await objectModelRef.current.detect(userVideoRef.current);
            const phoneDetected = predictions.some(p => p.class === 'cell phone' && p.score > 0.6);

            if (phoneDetected) {
              violationCounterRef.current.phone++;
              if (statusAlertRef.current !== "Phone detected! Mobile devices are strictly prohibited.") {
                statusAlertRef.current = "Phone detected! Mobile devices are strictly prohibited.";
                setStatusAlert("Phone detected! Mobile devices are strictly prohibited.");
              }
              if (violationCounterRef.current.phone >= 2) {
                handleCheatingRef.current?.("Phone detection");
                violationCounterRef.current.phone = 0;
              }
            } else {
              violationCounterRef.current.phone = 0;
            }
          }

        } catch (err) {
          console.error("AI Analysis Error:", err);
        }
      }, 1500);
      }, 2000); 

    }

    return () => {
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    };
  }, [isModelsLoaded, hasStarted]);
  const startRecording = (stream) => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      
      if (isFinishingRef.current) {
        await uploadVideo(blob);
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const isFinishingRef = useRef(false);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadVideo = async (blob) => {
    const formData = new FormData();
    formData.append("video", blob, `interview_${interviewId}.webm`);
    formData.append("interviewId", interviewId);

    try {
      setStatusAlert("Saving video recording...");
      await axios.post(ServerUrl + "/api/interview/upload-video", formData, {


        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true
      });
      console.log("Video uploaded successfully");
    } catch (err) {
      console.error("Failed to upload video", err);
    }
  };

  const uploadSnapshotsToServer = async () => {
    if (snapshotsRef.current.length === 0) return;
    try {
      setStatusAlert("Saving snapshots...");
      await axios.post(ServerUrl + "/api/interview/upload-snapshots", {
        interviewId,
        snapshots: snapshotsRef.current
      }, { withCredentials: true });
      console.log("Snapshots uploaded successfully");
    } catch (err) {
      console.error("Failed to upload snapshots", err);
      if (err.response?.status === 413) {
        console.error("Snapshot payload too large. Try reducing snapshot frequency or quality.");
      }
    }
  };

  const downloadRecording = () => {
    if (recordedVideoUrl) {
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      a.download = `interview_${interviewId}.webm`;
      a.click();
    }
  };

  const videoSource = voiceGender === "male"? maleVideo : femaleVideo;

  useEffect(() => {
    if (!videoRef.current) return;
    if (isAIPlaying) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isAIPlaying, hasStarted]);

  // speak function

  const speakText = (text) => {
    return new Promise((resolve) => {
      if(!window.speechSynthesis || !selectedVoice || !isMountedRef.current){
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

       const humanText = text
      .replace(/ and /gi, ", and ")
      .replace(/ but /gi, ", but ")
      .replace(/ because /gi, ", because ")
      .replace(/ so /gi, ", so ")
      .replace(/,/g, ", ..... ")
      .replace(/\./g, ". ...... ")
      .replace(/\?/g, "? ...... ")
      .replace(/!/g, "! ...... ");

      const utterance = new SpeechSynthesisUtterance(humanText);
      utterance.voice = selectedVoice;
      
      window.speechUtterance = utterance;

      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        if (!isMountedRef.current) return;
        setIsAIPlaying(true);
        stopMic();
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
      }

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          console.error("SpeechSynthesis error:", event.error);
        }
        if (isMountedRef.current) {
          setIsAIPlaying(false);
        }
        resolve();
      };

      utterance.onend = () => {
        if (!isMountedRef.current) {
          resolve();
          return;
        }

        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }

        if (isMicOn){
          startMic();
        }
        setIsAIPlaying(false);

          setSubtitle("");
          resolve();
      };

      setSubtitle(text);

      window.speechSynthesis.speak(utterance);
    })
  }

  useEffect(() => {
    if(!selectedVoice || !hasStarted){
      return;
    }

    const runIntro = async() => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      if(isIntroPhase){



        await speakText(
          `Welcome ${userName}, I’m excited to conduct your interview today. Please relax and answer naturally.`
        );

        await speakText(
          "I’ll ask you a few interview questions. Feel free to answer confidently and naturally. Let’s begin."
        );

        setIsIntroPhase(false);
      }else if (currentQuestion){

        if(currentIndex === questions.length-1){
          await speakText("This is your final question. Take your time and answer confidently.")
        }

        await speakText(currentQuestion.question);

        if(isMicOn){
          startMic();
        }
      }
    }

    runIntro()

  },[selectedVoice,isIntroPhase,currentIndex,hasStarted])

  useEffect(() => {
    if(isIntroPhase) return;
    if(!currentQuestion) return;
    if(isSubmitting) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if(prev <= 1){
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      })
    },1000);

    return ()=> clearInterval(timer);

  },[isIntroPhase,currentIndex,isSubmitting])

  useEffect(() => {
    if(!("webkitSpeechRecognition" in window)) return;

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      transcriptRef.current += " " + transcript;
      
      // Debounce state update to reduce re-renders
      if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
      transcriptTimeoutRef.current = setTimeout(() => {
        setAnswer(transcriptRef.current);
      }, 500);
    }

    recognitionRef.current = recognition;
  },[]);

  const startMic = () => {
    if(recognitionRef.current && !isAIPlaying){
      // Delay speech recognition to prevent blocking UI
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch { }
      }, 1200);
    }
  };

  const stopMic = () => {
    if(recognitionRef.current){
      recognitionRef.current.stop();
    }
  }

  const toggleMic = () => {
    if(isMicOn){
      stopMic();
    }else{
      startMic();
    }
    setIsMicOn(!isMicOn);
  };

  const submitAnswer = async () => {
    if(isSubmitting || isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopMic()
    setIsSubmitting(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer",{interviewId,
        questionIndex:currentIndex,
        answer,
        timetaken : currentQuestion.timeLimit - timeLeft
      },{
        withCredentials:true,
        signal: abortControllerRef.current.signal
      })

      if (isMountedRef.current) {
        setFeedback(result.data.feedback)
        speakText(result.data.feedback)
        setIsSubmitting(false)
        isProcessingRef.current = false;
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request cancelled");
      } else {
        console.log(error);
        if (isMountedRef.current) {
          setIsSubmitting(false);
          isProcessingRef.current = false;
        }
      }
    }
  }

  const handleNext = async() => {
    transcriptRef.current = "";
    setAnswer("");
   setFeedback("");

   if(currentIndex +1 >= questions.length){
    await finishInterview();
    return;
   }

   await speakText("Alright, let's move to the next question.");

   if (isMountedRef.current) {
     setCurrentIndex(currentIndex + 1);
     setTimeLeft(questions[currentIndex + 1]?.timeLimit || 0);
      setTimeout(() => {
        if(isMicOn) startMic();
      }, 500);
    }
   }

   const finishInterview = async(isViolation = false) => {
    window.speechSynthesis.cancel();
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
    }
    stopMic();
    setIsMicOn(false);
    isFinishingRef.current = true;
    
    stopRecording();
    stopCamera();
    
    if (isMountedRef.current) {
      setAnswer("");
      setFeedback("");
      setSubtitle("");
      setIsAIPlaying(false);
    }

    // Upload snapshots
    await uploadSnapshotsToServer();


    try {
      if (isMountedRef.current) setStatusAlert("Finalizing report...");
      
      abortControllerRef.current = new AbortController();
      const result = await axios.post(ServerUrl + "/api/interview/finish",{
        interviewId
      }, {
        withCredentials:true,
        signal: abortControllerRef.current.signal
      })

      console.log(result.data);
      if (isMountedRef.current) {
        setStatusAlert("");
        onFinish(result.data);
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Finish request cancelled");
      } else {
        console.log(error);
        if (isMountedRef.current) setStatusAlert("Error finalizing report.");
      }
    }
   }

   useEffect(() => {
    if(isIntroPhase) return;
    if(!currentQuestion) return;

    if(timeLeft === 0 && !isSubmitting && !feedback){
      submitAnswer();
    }
   },[timeLeft]);

   useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if(recognitionRef.current){
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
      stopCamera();
      stopRecording();
    }
   },[]);
  

  return (
    <div className='min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 flex 
    items-center justify-center p-4 sm:p-6'>

      
      <video src={maleVideo} preload="auto" muted playsInline className='hidden' />
      <video src={femaleVideo} preload="auto" muted playsInline className='hidden' />

      {!hasStarted ? (
        <div className='w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center text-center space-y-8 border border-emerald-100'>
          <div className='w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner'>
            <ShieldAlert size={40} />
          </div>
          <div className='space-y-4'>
            <h1 className='text-3xl font-bold text-gray-900'>Proctored Interview Setup</h1>
            <p className='text-gray-600 leading-relaxed max-w-md'>
              This interview uses AI monitoring and security enforcement. To begin, please enter 
              <span className='font-bold text-emerald-600'> Full-Screen Mode</span>. 
              The session will be recorded and your presence will be monitored.
            </p>
          </div>
          
          <ul className='text-left w-full space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-100 text-sm'>
            <li className='flex items-center gap-3 text-gray-700 font-medium'><div className='w-1.5 h-1.5 rounded-full bg-emerald-500'></div> Full-screen is enforced at all times</li>
            <li className='flex items-center gap-3 text-gray-700 font-medium'><div className='w-1.5 h-1.5 rounded-full bg-emerald-500'></div> Tab switching will end your session</li>
            <li className='flex items-center gap-3 text-gray-700 font-medium'><div className='w-1.5 h-1.5 rounded-full bg-emerald-500'></div> Copy/Paste and Right-click are disabled</li>
            <li className='flex items-center gap-3 text-gray-700 font-medium'><div className='w-1.5 h-1.5 rounded-full bg-emerald-500'></div> AI will monitor for multiple faces and phones</li>

          </ul>

          <motion.button
            onClick={startInterviewSession}
            disabled={isInitializing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className='w-full bg-emerald-600 text-white py-4 rounded-2xl text-lg font-bold shadow-xl hover:bg-emerald-700 transition flex items-center justify-center gap-3 disabled:bg-emerald-400'
          >
            {isInitializing ? "Initializing Secure Environment..." : "Start Secure Interview"} <ArrowRight size={22} />
          </motion.button>



        </div>
      ) : (
      <div className='w-full max-w-6xl min-h-[85vh] bg-white rounded-3xl shadow-2xl border 
      border-gray-200 flex flex-col overflow-hidden relative'>

        {!isFullscreen && hasStarted && (
          <div className='absolute inset-0 bg-black/60 backdrop-blur-md z-100 flex items-center justify-center p-6'>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className='bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6'
            >
              <div className='w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto'>
                <ShieldAlert size={32} />
              </div>
              <div className='space-y-2'>
                <h2 className='text-2xl font-bold text-gray-900'>Security Violation</h2>
                <p className='text-gray-600 text-sm'>
                  Exiting full-screen is not allowed during this proctored session. 
                  Please resume full-screen to continue.
                </p>
              </div>
              <button 
                onClick={startInterviewSession}
                className='w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2'
              >
                <VideoIcon size={20} /> Resume Full-Screen
              </button>
            </motion.div>
          </div>
        )}

        {/* TOP Split Screen */}
        <div className='w-full bg-gray-900 flex flex-col lg:flex-row p-4 gap-4 border-b border-gray-800'>
          
          {/* Left: AI Video */}
          <div className='w-full lg:w-1/2 relative rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center border border-gray-700'>
            <div className='absolute top-3 left-3 bg-black/60 text-emerald-400 text-xs px-3 py-1 rounded-full backdrop-blur-md z-10 border border-emerald-500/30 flex items-center gap-2'>
              <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
              AI Interviewer
            </div>
            
            <video 
            src={videoSource}
            key={videoSource}
            ref={videoRef}
            muted
            playsInline
            preload='auto'
              loop
              className='w-full aspect-video object-cover'
              style={{ willChange: 'transform' }}
            />

          {subtitle && (
              <div className='absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl z-20'>
                <p className='text-white text-sm sm:text-base font-medium text-center leading-relaxed drop-shadow-md'>{subtitle}</p>
            </div>
          )}
          </div>

          {/* Right: User Camera */}
          <div className='w-full lg:w-1/2 relative rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center border border-gray-800'>
            <div className='absolute top-3 left-3 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-md z-10 border border-white/20 flex items-center gap-2'>
               <div className='w-2 h-2 rounded-full bg-red-500 animate-pulse'></div>
               You
            </div>
            
            {cheatingAlert && (
              <div className='absolute top-12 left-3 right-3 bg-red-600 text-white text-[10px] px-3 py-2 rounded-lg backdrop-blur-md z-30 border border-red-400 flex items-center gap-2 animate-bounce font-bold shadow-lg'>
                <ShieldAlert size={14} />
                {cheatingAlert}
              </div>
            )}

            {statusAlert && !cheatingAlert && (
              <div className='absolute top-12 left-3 right-3 bg-orange-500/90 text-white text-[10px] px-3 py-2 rounded-lg backdrop-blur-md z-20 border border-orange-400 flex items-center gap-2 animate-pulse font-medium'>
                {statusAlert.toLowerCase().includes('phone') ? <Smartphone size={14} /> : <Camera size={14} />}
                {statusAlert}
              </div>
            )}

            <div className='absolute bottom-3 right-3 bg-emerald-500/80 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md z-20 border border-emerald-400 flex items-center gap-2'>
              <Camera size={12} />
              AI Emotion: {emotion}
            </div>



            <video
              ref={userVideoRef}
              autoPlay
              muted
              playsInline
              className='w-full aspect-video object-cover -scale-x-100 brightness-110 contrast-[1.05]'
            />

          </div>

        </div>

      
        <div className='flex-1 flex flex-col lg:flex-row p-6 sm:p-8 gap-8 bg-gray-50/50'>
          
         
          <div className='w-full lg:w-[30%] flex flex-col gap-6'>
             <div className='bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5'>
            <div className='flex justify-between items-center'>
                <span className='text-sm text-gray-500 font-medium'>Interview Status</span>
                {isAIPlaying && <span className='text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100'>AI Speaking</span>}
            </div>
            
              <div className='h-px bg-gray-100'></div>

              <div className='flex justify-center py-2'>
              <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit}/>
            </div>

              <div className='h-px bg-gray-100'></div>

              <div className='grid grid-cols-2 gap-6 text-center pt-2'>
              <div>
                  <div className='text-3xl font-bold text-emerald-600 mb-1'>{currentIndex + 1}</div>
                  <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold'>Current</div>
              </div>
              
              <div>
                  <div className='text-3xl font-bold text-gray-800 mb-1'>{questions.length}</div>
                  <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold'>Total</div>
                </div>
              </div>
              </div>

            <div className='bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4'>
              <div className='flex items-center gap-3 text-sm font-semibold text-gray-700'>
                <div className='p-2 bg-blue-50 text-blue-600 rounded-lg'>
                  <ShieldAlert size={18} />
            </div>
                AI Monitoring Active
              </div>
              <div className='grid grid-cols-1 gap-2'>
                <div className='flex justify-between text-xs'>
                  <span className='text-gray-500'>Proctoring</span>
                  <span className='text-emerald-600 font-bold'>ENFORCED</span>
          </div>


                <div className='flex justify-between text-xs'>
                  <span className='text-gray-500'>Recording</span>
                  <span className='text-emerald-600 font-bold uppercase'>{isRecording ? "Live" : "Standby"}</span>
                </div>
                <div className='flex justify-between text-xs'>
                  <span className='text-gray-500'>Snapshots Taken</span>
                  <span className='text-blue-600 font-bold'>{snapshots.length}</span>
        </div>

                <div className='flex justify-between text-xs'>
                  <span className='text-gray-500'>Warnings</span>
                  <span className={`font-bold ${warningCount > 1 ? 'text-red-600' : 'text-orange-500'}`}>{warningCount} / 3</span>
                </div>
              </div>
              {recordedVideoUrl && (
                <button 
                  onClick={downloadRecording}
                  className='w-full mt-2 flex items-center justify-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 py-2 rounded-lg transition-colors font-bold text-gray-700'
                >
                  <Download size={14} /> Download Recording
                </button>
              )}
              {!isFullscreen && hasStarted && (
                <button 
                  onClick={startInterviewSession}
                  className='w-full mt-2 flex items-center justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg transition-colors font-bold text-white shadow-md animate-pulse'
                >
                  <ShieldAlert size={14} /> Resume Full Screen
                </button>
              )}
            </div>
          </div>

          <div className='flex-1 flex flex-col'>
            <div className='flex items-center justify-between mb-6'>
               <h2 className='text-2xl font-bold text-gray-800 flex items-center gap-2'>
                  <span className='bg-emerald-100 text-emerald-600 p-2 rounded-lg'><Mic size={20} /></span>
                  SmartHire Assistant
          </h2>

               {isMicOn && !isAIPlaying && !isSubmitting && !isIntroPhase && (
                 <div className='flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200'>
                   <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
                   <span className='text-sm font-semibold text-emerald-700'>Listening...</span>
                 </div>
               )}
            </div>

            {!isIntroPhase && (
            <div className='relative mb-6 bg-white p-5 sm:p-6 rounded-2xl border border-emerald-100 shadow-sm border-l-4 border-l-emerald-500'>
              <div className='text-lg sm:text-xl font-semibold text-gray-800 leading-relaxed '>
              {currentQuestion?.question}
            </div>
            </div>
            )}

          <textarea
          placeholder='Type or speak your answer here...' 
          onChange={(e) => setAnswer(e.target.value)}
          value={answer}
            className='flex-1 bg-white p-5 sm:p-6 rounded-2xl resize-none outline-none border
            border-gray-200 focus:ring-2 focus:ring-emerald-500 transition text-gray-800 shadow-inner min-h-37.5'/>
          
           {!feedback ? (
           <div className='flex items-center gap-4 mt-6'>
          <motion.button
          onClick={toggleMic}
          whileTap={{scale:0.9}} 
            className={`w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg transition-colors ${isMicOn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
              {isMicOn ? <Mic size={24}/> : <MicOff size={24}/>}
          </motion.button>

          <motion.button
          onClick={submitAnswer}
          disabled={isSubmitting}
          whileTap={{scale:0.95}}
            className='flex-1 bg-gray-900 text-white
            py-4 rounded-2xl shadow-xl hover:bg-black transition text-lg font-semibold disabled:bg-gray-400'>
              {isSubmitting ? "Submitting Response..." : "Submit Response"}
          </motion.button>
           </div>
           ) : (
          <motion.div
            initial={{opacity:0, y: 10}}
            animate={{opacity:1, y: 0}} 
            className='mt-6 bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm'>
              <p className='text-emerald-800 font-medium mb-5 text-lg'>{feedback}</p>

            <button 
            onClick={handleNext}
              className='w-full bg-emerald-600 text-white
              py-4 rounded-xl shadow-md hover:bg-emerald-700 transition flex items-center justify-center gap-2 text-lg font-semibold'>
                {currentIndex + 1 >= questions.length ? "Finish Interview" : "Next Question"} <ArrowRight size={20}/>
            </button>
          </motion.div>
         )}
        </div>
      </div>
      </div>
      )}
    </div>
  )
}

export default React.memo(Step2Interview)