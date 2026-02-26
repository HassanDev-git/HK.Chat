import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import API from '../../api/axios';
import { FiArrowLeft, FiSearch, FiMoreVertical, FiPhone, FiVideo, FiTrash2, FiVolumeX, FiVolume2, FiArchive } from 'react-icons/fi';
import { BsThreeDotsVertical, BsShieldExclamation, BsShieldCheck, BsPin, BsPinFill } from 'react-icons/bs';

export default function ChatHeader({ chat, typing, onBlockStatusChange, blockStatus }) {
  const { setActiveChat, setView, loadChats } = useChat();
  const { onlineUsers } = useSocket();
  const { initiateCall, callState } = useCall();
  const [showDropdown, setShowDropdown] = useState(false);

  const isGroup = chat.type === 'group';
  const displayName = isGroup ? chat.name : chat.otherUser?.display_name;
  const profilePic = isGroup ? chat.group_pic : chat.otherUser?.profile_pic;
  const isOnline = !isGroup && chat.otherUser && onlineUsers.has(chat.otherUser.id);

  const getStatusText = () => {
    if (typing) return 'typing...';
    if (isGroup) {
      const count = chat.members?.length || 0;
      const onlineCount = chat.members?.filter(m => onlineUsers.has(m.id)).length || 0;
      return `${count} members${onlineCount > 0 ? `, ${onlineCount} online` : ''}`;
    }
    if (blockStatus?.iBlockedThem) return 'Blocked';
    if (isOnline) return 'online';
    if (chat.otherUser?.last_seen) {
      const date = new Date(chat.otherUser.last_seen + 'Z');
      const now = new Date();
      const diff = now - date;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'last seen just now';
      if (mins < 60) return `last seen ${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `last seen ${hours}h ago`;
      return `last seen ${date.toLocaleDateString()}`;
    }
    return '';
  };

  const handleHeaderClick = () => {
    if (isGroup) {
      setView('groupinfo');
    }
  };

  const handleBlockToggle = async () => {
    if (!chat.otherUser) return;
    try {
      const res = await API.post(`/users/block/${chat.otherUser.id}`);
      const isNowBlocked = res.data.blocked.includes(chat.otherUser.id);
      if (onBlockStatusChange) {
        onBlockStatusChange({ 
          ...blockStatus, 
          iBlockedThem: isNowBlocked 
        });
      }
      setShowDropdown(false);
    } catch (err) {
      console.error('Block toggle failed:', err);
    }
  };

  const handleDeleteChat = async () => {
    if (!window.confirm('Delete this chat? This will remove it from your chat list.')) return;
    try {
      await API.delete(`/chats/${chat.id}`);
      setActiveChat(null);
      loadChats();
      setShowDropdown(false);
    } catch (err) {
      console.error('Delete chat failed:', err);
    }
  };

  const handleMuteToggle = async () => {
    try {
      await API.put(`/chats/${chat.id}/mute`);
      loadChats();
      setShowDropdown(false);
    } catch (err) {
      console.error('Mute toggle failed:', err);
    }
  };

  const handlePinToggle = async () => {
    try {
      await API.put(`/chats/${chat.id}/pin`);
      loadChats();
      setShowDropdown(false);
    } catch (err) {
      console.error('Pin toggle failed:', err);
    }
  };

  const handleArchiveToggle = async () => {
    try {
      await API.put(`/chats/${chat.id}/archive`);
      setActiveChat(null);
      loadChats();
      setShowDropdown(false);
    } catch (err) {
      console.error('Archive toggle failed:', err);
    }
  };

  return (
    <div className="chat-header">
      <button className="icon-btn back-btn-mobile" onClick={() => setActiveChat(null)}>
        <FiArrowLeft />
      </button>

      <div className="chat-header-info" onClick={handleHeaderClick}>
        <div className="chat-header-avatar">
          {profilePic ? (
            <img src={profilePic} alt="" className="avatar" />
          ) : (
            <div className="avatar-placeholder">
              {isGroup ? '👥' : displayName?.[0]?.toUpperCase()}
            </div>
          )}
          {isOnline && <div className="online-dot" />}
        </div>
        <div className="chat-header-text">
          <h3>{displayName}</h3>
          <p className={`status-text ${typing ? 'typing' : ''}`}>{getStatusText()}</p>
        </div>
      </div>

      <div className="chat-header-actions">
        {!isGroup && chat.otherUser && (
          <>
            <button
              className="icon-btn"
              title="Video call"
              onClick={() => callState === 'idle' && initiateCall(chat.otherUser, 'video')}
              disabled={callState !== 'idle'}
            >
              <FiVideo />
            </button>
            <button
              className="icon-btn"
              title="Voice call"
              onClick={() => callState === 'idle' && initiateCall(chat.otherUser, 'voice')}
              disabled={callState !== 'idle'}
            >
              <FiPhone />
            </button>
          </>
        )}
        <div className="dropdown-container">
          <button className="icon-btn" onClick={() => setShowDropdown(!showDropdown)} title="More options">
            <BsThreeDotsVertical />
          </button>
          {showDropdown && (
            <div className="dropdown-menu chat-dropdown" onClick={() => setShowDropdown(false)}>
              {isGroup && (
                <button onClick={() => { setView('groupinfo'); setShowDropdown(false); }}>
                  👥 Group Info
                </button>
              )}
              <button onClick={handleMuteToggle}>
                {chat.member_muted ? <><FiVolume2 /> Unmute</> : <><FiVolumeX /> Mute</>}
              </button>
              <button onClick={handlePinToggle}>
                {chat.member_pinned ? <><BsPin /> Unpin</> : <><BsPinFill /> Pin</>}
              </button>
              <button onClick={handleArchiveToggle}>
                <FiArchive /> {chat.member_archived ? 'Unarchive' : 'Archive'}
              </button>
              {!isGroup && chat.otherUser && (
                <button onClick={handleBlockToggle} className={blockStatus?.iBlockedThem ? '' : 'danger'}>
                  {blockStatus?.iBlockedThem 
                    ? <><BsShieldCheck /> Unblock {chat.otherUser.display_name}</>
                    : <><BsShieldExclamation /> Block {chat.otherUser.display_name}</>}
                </button>
              )}
              <hr />
              <button onClick={handleDeleteChat} className="danger">
                <FiTrash2 /> Delete Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
