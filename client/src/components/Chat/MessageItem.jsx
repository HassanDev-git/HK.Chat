import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { BsCheck2All, BsCheck2, BsReply, BsStar, BsStarFill, BsTrash, BsPencil, BsDownload, BsForward } from 'react-icons/bs';
import { FiMoreVertical } from 'react-icons/fi';

export default function MessageItem({ message, isOwn, onReply }) {
  const { deleteMessage, editMessage, starMessage } = useChat();
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [starred, setStarred] = useState(false);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr + 'Z');
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, editContent.trim());
    }
    setEditing(false);
  };

  const handleStar = async () => {
    const result = await starMessage(message.id);
    setStarred(result);
    setShowMenu(false);
  };

  const handleDelete = async (forEveryone) => {
    await deleteMessage(message.id, forEveryone);
    setShowMenu(false);
  };

  const getReadStatus = () => {
    const readBy = typeof message.read_by === 'string' ? JSON.parse(message.read_by || '[]') : (message.read_by || []);
    const deliveredTo = typeof message.delivered_to === 'string' ? JSON.parse(message.delivered_to || '[]') : (message.delivered_to || []);
    if (readBy.length > 0) return 'seen';
    if (deliveredTo.length > 0) return 'delivered';
    return 'sent';
  };

  const readStatus = isOwn ? getReadStatus() : null;

  const getTickIcon = () => {
    if (!isOwn) return null;
    if (readStatus === 'seen') return <><BsCheck2All className="msg-tick seen" /><span className="seen-label">Seen</span></>;
    if (readStatus === 'delivered') return <BsCheck2All className="msg-tick delivered" />;
    return <BsCheck2 className="msg-tick sent" />;
  };

  if (message.type === 'system') {
    return (
      <div className="message-system">
        <span>{message.content}</span>
      </div>
    );
  }

  const renderContent = () => {
    if (message.is_deleted) {
      return <span className="deleted-message">🚫 This message was deleted</span>;
    }

    if (editing) {
      return (
        <div className="edit-message-form">
          <input
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
          <div className="edit-actions">
            <button onClick={handleEdit}>✓</button>
            <button onClick={() => setEditing(false)}>✕</button>
          </div>
        </div>
      );
    }

    switch (message.type) {
      case 'image':
        return (
          <div className="message-media">
            <img src={message.file_url} alt="" className="message-image" onClick={() => window.open(message.file_url)} />
            {message.content && <p className="media-caption">{message.content}</p>}
          </div>
        );
      case 'video':
        return (
          <div className="message-media">
            <video src={message.file_url} controls className="message-video" />
            {message.content && <p className="media-caption">{message.content}</p>}
          </div>
        );
      case 'audio':
        return (
          <div className="message-audio">
            <audio src={message.file_url} controls />
          </div>
        );
      case 'voice':
        return (
          <div className="message-voice">
            <div className="voice-wave">🎤</div>
            <audio src={message.file_url} controls className="voice-audio" />
            {message.duration && <span className="voice-duration">{Math.floor(message.duration / 60)}:{String(message.duration % 60).padStart(2, '0')}</span>}
          </div>
        );
      case 'document':
        return (
          <div className="message-document">
            <div className="doc-icon">📄</div>
            <div className="doc-info">
              <span className="doc-name">{message.file_name || 'Document'}</span>
              {message.file_size && <span className="doc-size">{(message.file_size / 1024).toFixed(1)} KB</span>}
            </div>
            <a href={message.file_url} download className="doc-download"><BsDownload /></a>
          </div>
        );
      default:
        return <p className="message-text">{message.content}</p>;
    }
  };

  return (
    <div className={`message-item ${isOwn ? 'own' : 'other'}`}>
      <div className="message-bubble">
        {/* Reply preview */}
        {message.replyMessage && (
          <div className="reply-preview">
            <div className="reply-bar" />
            <div className="reply-content">
              <span className="reply-sender">{message.replyMessage.sender_name}</span>
              <span className="reply-text">
                {message.replyMessage.type !== 'text' ? `📎 ${message.replyMessage.type}` : message.replyMessage.content}
              </span>
            </div>
          </div>
        )}

        {/* Sender name (in groups) */}
        {!isOwn && message.sender_name && (
          <span className="message-sender-name">{message.sender_name}</span>
        )}

        {/* Forwarded label */}
        {message.is_forwarded ? <span className="forwarded-label">⤵ Forwarded</span> : null}

        {/* Content */}
        {renderContent()}

        {/* Message meta */}
        <div className="message-meta">
          {starred && <BsStarFill className="star-indicator" />}
          {message.is_edited ? <span className="edited-label">edited</span> : null}
          <span className="message-time">{formatTime(message.created_at)}</span>
          {getTickIcon()}
        </div>

        {/* Hover menu */}
        {!message.is_deleted && (
          <div className="message-hover-menu">
            <button onClick={() => onReply(message)} title="Reply"><BsReply /></button>
            <button onClick={() => setShowMenu(!showMenu)} title="More"><FiMoreVertical /></button>
          </div>
        )}

        {/* Context menu */}
        {showMenu && (
          <div className="message-context-menu" onClick={() => setShowMenu(false)}>
            <button onClick={() => onReply(message)}><BsReply /> Reply</button>
            <button onClick={handleStar}>{starred ? <BsStarFill /> : <BsStar />} {starred ? 'Unstar' : 'Star'}</button>
            {isOwn && message.type === 'text' && (
              <button onClick={() => { setEditing(true); setShowMenu(false); }}><BsPencil /> Edit</button>
            )}
            <button onClick={() => { navigator.clipboard.writeText(message.content); setShowMenu(false); }}>📋 Copy</button>
            {isOwn && <button onClick={() => handleDelete(true)} className="danger"><BsTrash /> Delete for Everyone</button>}
            <button onClick={() => handleDelete(false)} className="danger"><BsTrash /> Delete for Me</button>
          </div>
        )}
      </div>
    </div>
  );
}
