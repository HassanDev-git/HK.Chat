import React from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { FiArrowLeft, FiSearch, FiMoreVertical, FiPhone, FiVideo } from 'react-icons/fi';
import { BsThreeDotsVertical } from 'react-icons/bs';

export default function ChatHeader({ chat, typing }) {
  const { setActiveChat, setView } = useChat();
  const { onlineUsers } = useSocket();

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
        <button className="icon-btn" title="Video call">
          <FiVideo />
        </button>
        <button className="icon-btn" title="Voice call">
          <FiPhone />
        </button>
        <button className="icon-btn" title="Search">
          <FiSearch />
        </button>
      </div>
    </div>
  );
}
