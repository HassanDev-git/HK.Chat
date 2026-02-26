import React, { useEffect } from 'react';
import { useCall } from '../../context/CallContext';
import { FiPhone, FiPhoneOff, FiMic, FiMicOff, FiVideo, FiVideoOff, FiVolume2 } from 'react-icons/fi';
import { BsTelephoneFill, BsCameraVideoFill, BsCameraVideoOffFill } from 'react-icons/bs';

export default function CallScreen() {
  const {
    callState,
    callType,
    remoteUser,
    callDuration,
    isMuted,
    isVideoOff,
    localVideoRef,
    remoteVideoRef,
    localStreamRef,
    remoteStreamRef,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker
  } = useCall();

  // Ensure remote stream is attached to the media element whenever component re-renders
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    }
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  });

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callState) {
      case 'calling': return 'Calling...';
      case 'incoming': return `Incoming ${callType} call...`;
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call ended';
      default: return '';
    }
  };

  if (callState === 'idle') return null;

  const isVideoCall = callType === 'video';

  return (
    <div className={`call-screen ${isVideoCall ? 'video-call' : 'voice-call'}`}>
      {/* Video elements (hidden for voice calls) */}
      {isVideoCall && (
        <div className="call-video-container">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="call-remote-video"
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="call-local-video"
          />
        </div>
      )}

      {/* Audio element for voice calls */}
      {!isVideoCall && (
        <audio ref={remoteVideoRef} autoPlay playsInline />
      )}

      {/* Call info overlay */}
      <div className={`call-info-overlay ${callState === 'connected' && isVideoCall ? 'minimal' : ''}`}>
        {/* User avatar */}
        <div className="call-user-section">
          <div className={`call-avatar ${callState === 'calling' ? 'pulsing' : ''} ${callState === 'incoming' ? 'ringing' : ''}`}>
            {remoteUser?.profile_pic ? (
              <img src={remoteUser.profile_pic} alt="" />
            ) : (
              <span>{remoteUser?.display_name?.[0]?.toUpperCase() || '?'}</span>
            )}
          </div>
          <h2 className="call-user-name">{remoteUser?.display_name || 'Unknown'}</h2>
          <p className="call-status">{getStatusText()}</p>
          {callType && (
            <p className="call-type-label">
              {isVideoCall ? '🎥 Video Call' : '📞 Voice Call'}
            </p>
          )}
        </div>

        {/* Incoming call actions */}
        {callState === 'incoming' && (
          <div className="call-incoming-actions">
            <button className="call-action-btn reject" onClick={() => rejectCall(remoteUser?.id)}>
              <FiPhoneOff />
              <span>Decline</span>
            </button>
            <button className="call-action-btn accept" onClick={acceptCall}>
              {isVideoCall ? <FiVideo /> : <FiPhone />}
              <span>Accept</span>
            </button>
          </div>
        )}

        {/* Calling actions (outgoing, waiting for answer) */}
        {callState === 'calling' && (
          <div className="call-actions">
            <button className="call-action-btn end-call" onClick={endCall}>
              <FiPhoneOff />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* Connected call actions */}
        {callState === 'connected' && (
          <div className="call-actions">
            <button
              className={`call-control-btn ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? <FiMicOff /> : <FiMic />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {isVideoCall && (
              <button
                className={`call-control-btn ${isVideoOff ? 'active' : ''}`}
                onClick={toggleVideo}
              >
                {isVideoOff ? <FiVideoOff /> : <FiVideo />}
                <span>{isVideoOff ? 'Camera On' : 'Camera Off'}</span>
              </button>
            )}

            <button className="call-control-btn" onClick={toggleSpeaker}>
              <FiVolume2 />
              <span>Speaker</span>
            </button>

            <button className="call-action-btn end-call" onClick={endCall}>
              <FiPhoneOff />
              <span>End</span>
            </button>
          </div>
        )}

        {/* Ended state */}
        {callState === 'ended' && (
          <div className="call-ended-info">
            <p>Call Ended</p>
          </div>
        )}
      </div>
    </div>
  );
}
