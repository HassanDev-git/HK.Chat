import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext();

// ICE servers for WebRTC
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

export function CallProvider({ children }) {
  const { socket, connected, emit } = useSocket();
  const { user } = useAuth();

  // Call state
  const [callState, setCallState] = useState('idle'); // idle, calling, incoming, connected, ended
  const [callType, setCallType] = useState(null); // 'voice' or 'video'
  const [remoteUser, setRemoteUser] = useState(null); // The other user in the call
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Refs
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const ringtoneRef = useRef(null);
  const ringbackRef = useRef(null);
  const durationTimerRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const iceCandidateQueueRef = useRef([]);

  // Create ringtone sound
  const playRingtone = useCallback(() => {
    try {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playTone = () => {
        if (!ringtoneRef.current?._playing) return;
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;
        gain.gain.value = 0.3;
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1);
        osc2.stop(now + 1);
        
        // Repeat after 2 seconds
        setTimeout(() => playTone(), 2000);
      };

      ringtoneRef.current = { _playing: true, pause: () => { 
        ringtoneRef.current._playing = false;
        audioCtx.close().catch(() => {});
      }};
      
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playTone();
    } catch (e) {
      console.log('Ringtone error:', e);
    }
  }, []);

  const playRingback = useCallback(() => {
    try {
      if (ringbackRef.current) {
        ringbackRef.current.pause();
        ringbackRef.current = null;
      }
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playTone = () => {
        if (!ringbackRef.current?._playing) return;
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.frequency.value = 440;
        gain.gain.value = 0.15;
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        osc.start(now);
        osc.stop(now + 0.4);
        
        setTimeout(() => playTone(), 3000);
      };

      ringbackRef.current = { _playing: true, pause: () => {
        ringbackRef.current._playing = false;
        audioCtx.close().catch(() => {});
      }};
      
      if (audioCtx.state === 'suspended') audioCtx.resume();
      playTone();
    } catch (e) {
      console.log('Ringback error:', e);
    }
  }, []);

  const stopAllSounds = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    if (ringbackRef.current) {
      ringbackRef.current.pause();
      ringbackRef.current = null;
    }
  }, []);

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Cleanup peer connection
  const cleanupCall = useCallback(() => {
    stopAllSounds();
    stopDurationTimer();
    
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    iceCandidateQueueRef.current = [];
    setIsMuted(false);
    setIsVideoOff(false);
    setCallDuration(0);
  }, [stopAllSounds, stopDurationTimer]);

  // Helper to flush buffered ICE candidates
  const flushIceCandidateQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    const candidates = [...iceCandidateQueueRef.current];
    iceCandidateQueueRef.current = [];
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add buffered ICE candidate:', err);
      }
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('call:ice-candidate', {
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('ontrack fired, streams:', event.streams.length);
      remoteStreamRef.current = event.streams[0];
      // Retry setting srcObject in case the media element isn't mounted yet
      const setStream = () => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else {
          setTimeout(setStream, 100);
        }
      };
      setStream();
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        endCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [emit]);

  // Initiate a call
  const initiateCall = useCallback(async (targetUser, type) => {
    if (callState !== 'idle') return;

    try {
      setCallState('calling');
      setCallType(type);
      setRemoteUser(targetUser);

      // Get media
      const constraints = {
        audio: true,
        video: type === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = createPeerConnection(targetUser.id);

      // Add tracks
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send call initiation
      emit('call:initiate', {
        targetUserId: targetUser.id,
        callType: type,
        offer: pc.localDescription
      });

      // Play ringback
      playRingback();

      // Set timeout (30 seconds)
      callTimeoutRef.current = setTimeout(() => {
        if (callState === 'calling') {
          emit('call:end', { targetUserId: targetUser.id });
          setCallState('ended');
          cleanupCall();
          setTimeout(() => setCallState('idle'), 2000);
        }
      }, 30000);

    } catch (err) {
      console.error('Failed to initiate call:', err);
      setCallState('idle');
      cleanupCall();
      alert('Failed to start call. Please check your microphone/camera permissions.');
    }
  }, [callState, createPeerConnection, emit, playRingback, cleanupCall]);

  // Accept incoming call
  const acceptCall = useCallback(async (callerData, type, offer) => {
    try {
      setCallState('connected');

      const constraints = {
        audio: true,
        video: type === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = createPeerConnection(callerData.id);

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Flush any ICE candidates that arrived before remote description was set
        await flushIceCandidateQueue();
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      emit('call:accept', {
        callerId: callerData.id,
        answer: pc.localDescription
      });

      stopAllSounds();
      startDurationTimer();

    } catch (err) {
      console.error('Failed to accept call:', err);
      rejectCall(callerData.id);
    }
  }, [createPeerConnection, emit, stopAllSounds, startDurationTimer, flushIceCandidateQueue]);

  // Reject call
  const rejectCall = useCallback((callerId) => {
    emit('call:reject', { callerId });
    setCallState('idle');
    setRemoteUser(null);
    setCallType(null);
    cleanupCall();
  }, [emit, cleanupCall]);

  // End call
  const endCall = useCallback(() => {
    if (remoteUser) {
      emit('call:end', { targetUserId: remoteUser.id });
    }
    setCallState('ended');
    cleanupCall();
    setTimeout(() => {
      setCallState('idle');
      setRemoteUser(null);
      setCallType(null);
    }, 1500);
  }, [remoteUser, emit, cleanupCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(prev => !prev);
    if (remoteVideoRef.current) {
      // Some browsers support setSinkId
      if (typeof remoteVideoRef.current.setSinkId === 'function') {
        // Toggle between default and speaker
      }
    }
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !connected || !user) return;

    const handleIncomingCall = ({ caller, callType: type, offer }) => {
      if (callState !== 'idle') {
        // Already in a call, auto reject
        emit('call:reject', { callerId: caller.id });
        return;
      }
      setCallState('incoming');
      setCallType(type);
      setRemoteUser(caller);
      // Store pending offer in a SEPARATE ref, don't overwrite peerConnectionRef
      pendingOfferRef.current = { offer, callerId: caller.id };
      iceCandidateQueueRef.current = []; // Clear queue for new call
      playRingtone();
    };

    const handleCallAccepted = async ({ userId: acceptedBy, answer }) => {
      stopAllSounds();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
      setCallState('connected');
      startDurationTimer();

      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          // Flush any ICE candidates that arrived before remote description was set
          const candidates = [...iceCandidateQueueRef.current];
          iceCandidateQueueRef.current = [];
          for (const candidate of candidates) {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn('Failed to add buffered ICE candidate (caller side):', e);
            }
          }
        } catch (err) {
          console.error('Failed to set remote description:', err);
        }
      }
    };

    const handleCallRejected = ({ userId: rejectedBy }) => {
      stopAllSounds();
      setCallState('ended');
      cleanupCall();
      setTimeout(() => {
        setCallState('idle');
        setRemoteUser(null);
        setCallType(null);
      }, 2000);
    };

    const handleCallEnded = ({ userId: endedBy }) => {
      stopAllSounds();
      setCallState('ended');
      cleanupCall();
      setTimeout(() => {
        setCallState('idle');
        setRemoteUser(null);
        setCallType(null);
      }, 1500);
    };

    const handleIceCandidate = async ({ candidate, from }) => {
      const pc = peerConnectionRef.current;
      // Only add ICE candidate if we have a real peer connection with remote description set
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Failed to add ICE candidate:', err);
        }
      } else {
        // Buffer candidates until peer connection is ready
        console.log('Buffering ICE candidate (PC not ready)');
        iceCandidateQueueRef.current.push(candidate);
      }
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:ice-candidate', handleIceCandidate);
    };
  }, [socket, connected, user, callState, emit, playRingtone, stopAllSounds, startDurationTimer, cleanupCall]);

  // Handle accepting when in incoming state (need offer from ref)
  const handleAcceptCall = useCallback(async () => {
    const pending = pendingOfferRef.current;
    if (pending?.offer) {
      const offer = pending.offer;
      pendingOfferRef.current = null; // Clear pending
      await acceptCall(remoteUser, callType, offer);
    } else {
      await acceptCall(remoteUser, callType, null);
    }
  }, [acceptCall, remoteUser, callType]);

  return (
    <CallContext.Provider value={{
      callState,
      callType,
      remoteUser,
      callDuration,
      isMuted,
      isVideoOff,
      isSpeaker,
      localVideoRef,
      remoteVideoRef,
      localStreamRef,
      remoteStreamRef,
      initiateCall,
      acceptCall: handleAcceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleVideo,
      toggleSpeaker
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
