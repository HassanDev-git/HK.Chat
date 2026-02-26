import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../api/axios';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { FiUsers, FiCheck, FiX } from 'react-icons/fi';

export default function JoinGroup() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { loadChats, openChat, setView } = useChat();
  const { emit } = useSocket();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    loadInviteInfo();
  }, [inviteCode]);

  const loadInviteInfo = async () => {
    try {
      const res = await API.get(`/chats/invite/${inviteCode}`);
      setGroupInfo(res.data.group);
      if (res.data.isMember) {
        setJoined(true);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await API.post(`/chats/group/join/${inviteCode}`);
      const chat = res.data.chat;
      
      // Notify via socket
      emit('chat:created', { chat });
      emit('group:memberAdded', { chatId: chat.id, userId: null }); // Will refresh for all
      
      await loadChats();
      await openChat(chat);
      setView('chats');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  const handleGoToChat = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="join-group-page">
        <div className="join-group-card">
          <div className="loading-spinner"></div>
          <p>Loading invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="join-group-page">
        <div className="join-group-card">
          <div className="join-group-icon error">
            <FiX />
          </div>
          <h2>Invalid Invite</h2>
          <p>{error}</p>
          <button className="auth-btn" onClick={() => navigate('/')}>Go to Chat</button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-group-page">
      <div className="join-group-card">
        <div className="join-group-avatar">
          {groupInfo?.group_pic ? (
            <img src={groupInfo.group_pic} alt="" />
          ) : (
            <div className="avatar-placeholder large">👥</div>
          )}
        </div>
        <h2>{groupInfo?.name}</h2>
        {groupInfo?.description && <p className="join-group-desc">{groupInfo.description}</p>}
        <p className="join-group-members">
          <FiUsers /> {groupInfo?.memberCount} member{groupInfo?.memberCount !== 1 ? 's' : ''}
        </p>

        {joined ? (
          <>
            <div className="join-group-icon success">
              <FiCheck />
            </div>
            <p>You are already a member of this group</p>
            <button className="auth-btn" onClick={handleGoToChat}>Open Chat</button>
          </>
        ) : (
          <button className="auth-btn" onClick={handleJoin} disabled={joining}>
            {joining ? 'Joining...' : 'Join Group'}
          </button>
        )}
      </div>
    </div>
  );
}
