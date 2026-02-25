import React, { useState, useEffect, useRef } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { FiArrowLeft, FiPlus, FiX, FiSmile, FiImage } from 'react-icons/fi';
import { BsEye } from 'react-icons/bs';

export default function StatusPage() {
  const { user } = useAuth();
  const { setView } = useChat();
  const { emit } = useSocket();
  const [myStatuses, setMyStatuses] = useState([]);
  const [otherStatuses, setOtherStatuses] = useState([]);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [bgColor, setBgColor] = useState('#128C7E');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  const bgColors = ['#128C7E', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FDCB6E', '#6C5CE7', '#FD79A8', '#636E72', '#2D3436', '#E17055', '#00B894'];

  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    try {
      const res = await API.get('/status');
      setMyStatuses(res.data.myStatuses);
      setOtherStatuses(res.data.otherStatuses);
    } catch (err) {
      console.error('Failed to load statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTextStatus = async () => {
    if (!statusText.trim()) return;
    try {
      await API.post('/status', {
        type: 'text',
        content: statusText,
        background_color: bgColor
      });
      emit('status:new', { type: 'text' });
      setStatusText('');
      setShowCreate(false);
      loadStatuses();
    } catch (err) {
      console.error('Failed to create status:', err);
    }
  };

  const createImageStatus = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await API.post('/upload?type=status', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await API.post('/status', {
        type: 'image',
        file_url: uploadRes.data.url
      });
      emit('status:new', { type: 'image' });
      loadStatuses();
    } catch (err) {
      console.error('Failed to create status:', err);
    }
  };

  const viewStatus = async (statusGroup, index = 0) => {
    setViewingStatus(statusGroup);
    setViewingIndex(index);
    
    // Mark as viewed
    if (statusGroup.statuses) {
      const status = statusGroup.statuses[index];
      if (status) {
        try {
          await API.post(`/status/${status.id}/view`);
          emit('status:viewed', { statusId: status.id, ownerId: statusGroup.user.id });
        } catch (err) {}
      }
    }

    // Auto-advance
    startTimer(statusGroup, index);
  };

  const startTimer = (statusGroup, index) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index < (statusGroup.statuses?.length || 1) - 1) {
        viewStatus(statusGroup, index + 1);
      } else {
        setViewingStatus(null);
      }
    }, 5000);
  };

  const deleteStatus = async (statusId) => {
    try {
      await API.delete(`/status/${statusId}`);
      loadStatuses();
    } catch (err) {
      console.error('Failed to delete status:', err);
    }
  };

  // Status Viewer overlay
  if (viewingStatus) {
    const statuses = viewingStatus.statuses || myStatuses;
    const current = statuses[viewingIndex];
    if (!current) {
      setViewingStatus(null);
      return null;
    }
    const statusUser = viewingStatus.user || user;

    return (
      <div className="status-viewer-overlay">
        <div className="status-viewer">
          <div className="status-viewer-header">
            <div className="status-progress-bars">
              {statuses.map((_, i) => (
                <div key={i} className={`progress-bar ${i < viewingIndex ? 'completed' : i === viewingIndex ? 'active' : ''}`}>
                  <div className="progress-fill" />
                </div>
              ))}
            </div>
            <div className="status-viewer-user">
              <div className="avatar-small">
                {statusUser.profile_pic ? (
                  <img src={statusUser.profile_pic} alt="" />
                ) : (
                  <div className="avatar-placeholder small">{statusUser.display_name?.[0]}</div>
                )}
              </div>
              <div className="status-viewer-info">
                <h4>{statusUser.display_name}</h4>
                <p>{new Date(current.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <button className="icon-btn" onClick={() => { setViewingStatus(null); if (timerRef.current) clearTimeout(timerRef.current); }}>
                <FiX />
              </button>
            </div>
          </div>

          <div className="status-viewer-content"
            style={current.type === 'text' ? { backgroundColor: current.background_color || '#128C7E' } : {}}>
            {current.type === 'text' ? (
              <p className="status-text-content">{current.content}</p>
            ) : current.type === 'image' ? (
              <img src={current.file_url} alt="" className="status-image-content" />
            ) : current.type === 'video' ? (
              <video src={current.file_url} controls autoPlay className="status-video-content" />
            ) : null}
          </div>

          <div className="status-viewer-footer">
            {viewingStatus.user?.id === user.id && (
              <div className="status-viewers-count">
                <BsEye /> {JSON.parse(current.viewers || '[]').length} views
              </div>
            )}
          </div>

          {/* Navigation arrows */}
          {viewingIndex > 0 && (
            <button className="status-nav prev" onClick={() => viewStatus(viewingStatus, viewingIndex - 1)}>‹</button>
          )}
          {viewingIndex < statuses.length - 1 && (
            <button className="status-nav next" onClick={() => viewStatus(viewingStatus, viewingIndex + 1)}>›</button>
          )}
        </div>
      </div>
    );
  }

  // Create Status overlay
  if (showCreate) {
    return (
      <div className="sidebar status-create-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setShowCreate(false)}>
            <FiArrowLeft />
          </button>
          <h3>Create Status</h3>
        </div>
        <div className="status-create-content" style={{ backgroundColor: bgColor }}>
          <textarea
            className="status-text-input"
            placeholder="Type a status"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            autoFocus
          />
        </div>
        <div className="status-create-footer">
          <div className="bg-colors">
            {bgColors.map(color => (
              <button
                key={color}
                className={`color-btn ${bgColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setBgColor(color)}
              />
            ))}
          </div>
          <button className="send-status-btn" onClick={createTextStatus} disabled={!statusText.trim()}>
            Post Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar status-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => setView('chats')}>
          <FiArrowLeft />
        </button>
        <h3>Status</h3>
      </div>

      <div className="status-content">
        {/* My Status */}
        <div className="status-section">
          <div className="status-my" onClick={() => myStatuses.length > 0 ? viewStatus({ user, statuses: myStatuses }) : setShowCreate(true)}>
            <div className="status-avatar-wrapper">
              <div className="avatar-small">
                {user?.profile_pic ? (
                  <img src={user.profile_pic} alt="" />
                ) : (
                  <div className="avatar-placeholder">{user?.display_name?.[0]}</div>
                )}
              </div>
              {myStatuses.length === 0 && <div className="status-add-icon"><FiPlus /></div>}
            </div>
            <div className="status-info">
              <h4>My Status</h4>
              <p>{myStatuses.length > 0 ? `${myStatuses.length} status updates` : 'Tap to add status update'}</p>
            </div>
          </div>
          <div className="status-actions">
            <button className="icon-btn" onClick={() => setShowCreate(true)} title="Text status">
              <FiSmile />
            </button>
            <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Photo status">
              <FiImage />
            </button>
            <input ref={fileInputRef} type="file" hidden accept="image/*,video/*" onChange={createImageStatus} />
          </div>
        </div>

        {/* Other Statuses */}
        {otherStatuses.length > 0 && (
          <div className="status-section">
            <h5 className="section-title">Recent updates</h5>
            {otherStatuses.map(group => (
              <div key={group.user.id} className="status-item" onClick={() => viewStatus(group)}>
                <div className={`status-avatar-ring ${group.statuses.some(s => !JSON.parse(s.viewers || '[]').includes(user.id)) ? 'unseen' : 'seen'}`}>
                  <div className="avatar-small">
                    {group.user.profile_pic ? (
                      <img src={group.user.profile_pic} alt="" />
                    ) : (
                      <div className="avatar-placeholder">{group.user.display_name?.[0]}</div>
                    )}
                  </div>
                </div>
                <div className="status-info">
                  <h4>{group.user.display_name}</h4>
                  <p>{new Date(group.statuses[group.statuses.length - 1].created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {otherStatuses.length === 0 && !loading && (
          <div className="empty-state">
            <p>No status updates</p>
          </div>
        )}
      </div>
    </div>
  );
}
