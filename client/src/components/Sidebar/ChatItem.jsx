import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { BsCheck2All, BsCheck2, BsMicFill, BsCameraFill, BsFileEarmark, BsPinAngleFill } from 'react-icons/bs';

export default function ChatItem({ chat, isActive, typing, onClick }) {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  
  const isGroup = chat.type === 'group';
  const displayName = isGroup ? chat.name : chat.otherUser?.display_name;
  const profilePic = isGroup ? chat.group_pic : chat.otherUser?.profile_pic;
  const isOnline = !isGroup && chat.otherUser && onlineUsers.has(chat.otherUser.id);
  const lastMsg = chat.lastMessage;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessagePreview = () => {
    if (typing) return null;
    if (!lastMsg) return 'No messages yet';
    if (lastMsg.is_deleted) return '🚫 This message was deleted';
    
    const prefix = isGroup && lastMsg.sender_id !== user.id 
      ? `${lastMsg.sender_name}: ` 
      : lastMsg.sender_id === user.id ? 'You: ' : '';

    switch (lastMsg.type) {
      case 'image': return `${prefix}📷 Photo`;
      case 'video': return `${prefix}🎥 Video`;
      case 'audio': return `${prefix}🎵 Audio`;
      case 'voice': return `${prefix}🎤 Voice message`;
      case 'document': return `${prefix}📄 ${lastMsg.file_name || 'Document'}`;
      case 'sticker': return `${prefix}🏷️ Sticker`;
      case 'location': return `${prefix}📍 Location`;
      case 'contact': return `${prefix}👤 Contact`;
      case 'system': return lastMsg.content;
      default: return `${prefix}${lastMsg.content}`;
    }
  };

  const getTickIcon = () => {
    if (!lastMsg || lastMsg.sender_id !== user.id) return null;
    const readBy = typeof lastMsg.read_by === 'string' ? JSON.parse(lastMsg.read_by || '[]') : (lastMsg.read_by || []);
    if (readBy.length > 0) return <BsCheck2All className="tick-icon read" />;
    const deliveredTo = typeof lastMsg.delivered_to === 'string' ? JSON.parse(lastMsg.delivered_to || '[]') : (lastMsg.delivered_to || []);
    if (deliveredTo.length > 0) return <BsCheck2All className="tick-icon delivered" />;
    return <BsCheck2 className="tick-icon" />;
  };

  return (
    <div className={`chat-item ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="chat-item-avatar">
        {profilePic ? (
          <img src={profilePic} alt="" className="avatar" />
        ) : (
          <div className="avatar-placeholder">
            {isGroup ? '👥' : displayName?.[0]?.toUpperCase()}
          </div>
        )}
        {isOnline && <div className="online-dot" />}
      </div>

      <div className="chat-item-content">
        <div className="chat-item-top">
          <h4 className="chat-item-name">{displayName || 'Unknown'}</h4>
          <span className={`chat-item-time ${chat.unread_count ? 'unread' : ''}`}>
            {formatTime(lastMsg?.created_at || chat.updated_at)}
          </span>
        </div>
        <div className="chat-item-bottom">
          <div className="chat-item-preview">
            {typing ? (
              <span className="typing-indicator-text">typing...</span>
            ) : (
              <>
                {getTickIcon()}
                <span className="preview-text">{getMessagePreview()}</span>
              </>
            )}
          </div>
          <div className="chat-item-badges">
            {chat.member_pinned ? <BsPinAngleFill className="pin-icon" /> : null}
            {chat.unread_count > 0 && (
              <span className="unread-badge">{chat.unread_count > 99 ? '99+' : chat.unread_count}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
