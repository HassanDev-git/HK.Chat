import React, { useState, useRef } from 'react';
import API from '../../api/axios';
import EmojiPicker from 'emoji-picker-react';
import { FiSmile, FiPaperclip, FiSend, FiX, FiImage, FiVideo, FiFile } from 'react-icons/fi';
import { BsMic, BsStopFill } from 'react-icons/bs';

export default function MessageInput({ onSend, onTyping, replyTo, onCancelReply, chatId }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend({ type: 'text', content: text.trim() });
    setText('');
    setShowEmoji(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    onTyping();
  };

  const handleEmojiClick = (emojiData) => {
    setText(prev => prev + emojiData.emoji);
  };

  const uploadFile = async (file, type = 'document') => {
    setUploading(true);
    setShowAttach(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await API.post(`/upload?type=${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      let msgType = 'document';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';
      await onSend({
        type: msgType,
        content: '',
        file_url: res.data.url,
        file_name: res.data.name,
        file_size: res.data.size,
        file_type: res.data.type
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, type);
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('voice', blob, 'voice-message.webm');
          formData.append('duration', recordingTime);
          const res = await API.post('/upload/voice', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          await onSend({
            type: 'voice', content: '',
            file_url: res.data.url, file_name: res.data.name,
            file_size: res.data.size, file_type: res.data.type,
            duration: recordingTime
          });
        } catch (err) {
          console.error('Voice upload failed:', err);
        } finally {
          setUploading(false);
        }
      };
      mediaRecorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert('Microphone access is required for voice messages');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setRecordingTime(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (recording) {
    return (
      <div className="message-input recording-mode">
        <button className="icon-btn cancel-rec" onClick={cancelRecording}><FiX /></button>
        <div className="recording-indicator">
          <span className="rec-dot"></span>
          <span className="rec-time">{formatTime(recordingTime)}</span>
          <span className="rec-text">Recording...</span>
        </div>
        <button className="icon-btn send-btn" onClick={stopRecording}><FiSend /></button>
      </div>
    );
  }

  return (
    <div className="message-input-wrapper">
      {replyTo && (
        <div className="reply-bar-input">
          <div className="reply-accent"></div>
          <div className="reply-info">
            <span className="reply-sender">{replyTo.sender_name}</span>
            <span className="reply-text">{replyTo.type !== 'text' ? `📎 ${replyTo.type}` : replyTo.content}</span>
          </div>
          <button className="icon-btn" onClick={onCancelReply}><FiX /></button>
        </div>
      )}
      <div className="message-input">
        <div className="emoji-container">
          <button className="icon-btn" onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}>
            <FiSmile />
          </button>
          {showEmoji && (
            <div className="emoji-picker-wrapper">
              <EmojiPicker onEmojiClick={handleEmojiClick} width={320} height={400} theme="dark" />
            </div>
          )}
        </div>
        <div className="attach-container">
          <button className="icon-btn" onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}>
            <FiPaperclip />
          </button>
          {showAttach && (
            <div className="attach-menu">
              <button onClick={() => imageInputRef.current?.click()} className="attach-opt img-opt"><FiImage /> Photo</button>
              <button onClick={() => videoInputRef.current?.click()} className="attach-opt vid-opt"><FiVideo /> Video</button>
              <button onClick={() => fileInputRef.current?.click()} className="attach-opt doc-opt"><FiFile /> Document</button>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" hidden onChange={(e) => handleFileSelect(e, 'document')} />
        <input ref={imageInputRef} type="file" hidden accept="image/*" onChange={(e) => handleFileSelect(e, 'image')} />
        <input ref={videoInputRef} type="file" hidden accept="video/*" onChange={(e) => handleFileSelect(e, 'video')} />
        <input
          type="text"
          className="text-input"
          placeholder={uploading ? 'Uploading...' : 'Type a message'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={uploading}
        />
        {text.trim() ? (
          <button className="icon-btn send-btn" onClick={handleSend}><FiSend /></button>
        ) : (
          <button className="icon-btn mic-btn" onClick={startRecording} disabled={uploading}><BsMic /></button>
        )}
      </div>
    </div>
  );
}
