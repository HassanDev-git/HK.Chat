import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { FiX, FiSearch, FiSend } from 'react-icons/fi';
import { BsCheck2 } from 'react-icons/bs';

export default function ForwardDialog({ message, onClose }) {
  const { chats, forwardMessage } = useChat();
  const { user } = useAuth();
  const [selectedChats, setSelectedChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const filteredChats = chats.filter(chat => {
    if (chat.member_archived) return false;
    const name = chat.type === 'private'
      ? chat.otherUser?.display_name
      : chat.name;
    if (searchQuery && !name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const toggleChat = (chatId) => {
    setSelectedChats(prev =>
      prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    );
  };

  const handleForward = async () => {
    if (selectedChats.length === 0 || forwarding) return;
    setForwarding(true);
    try {
      await forwardMessage(message.id, selectedChats);
      onClose();
    } catch (err) {
      console.error('Forward failed:', err);
      alert('Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };

  const getMessagePreview = () => {
    if (message.is_deleted) return '🚫 Deleted message';
    switch (message.type) {
      case 'image': return '📷 Photo';
      case 'video': return '🎥 Video';
      case 'voice': return '🎤 Voice message';
      case 'audio': return '🎵 Audio';
      case 'document': return `📄 ${message.file_name || 'Document'}`;
      default: return message.content?.substring(0, 100) || '';
    }
  };

  return (
    <div className="forward-dialog-overlay" onClick={onClose}>
      <div className="forward-dialog" onClick={e => e.stopPropagation()}>
        <div className="forward-dialog-header">
          <h3>Forward Message</h3>
          <button className="icon-btn" onClick={onClose}><FiX /></button>
        </div>

        {/* Message preview */}
        <div className="forward-message-preview">
          <span className="forward-preview-label">Forwarding:</span>
          <span className="forward-preview-text">{getMessagePreview()}</span>
        </div>

        {/* Search */}
        <div className="forward-search">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Selected count */}
        {selectedChats.length > 0 && (
          <div className="forward-selected-count">
            {selectedChats.length} chat{selectedChats.length > 1 ? 's' : ''} selected
          </div>
        )}

        {/* Chat list */}
        <div className="forward-chat-list">
          {filteredChats.map(chat => {
            const name = chat.type === 'private'
              ? chat.otherUser?.display_name
              : chat.name;
            const pic = chat.type === 'private'
              ? chat.otherUser?.profile_pic
              : chat.group_pic;
            const isSelected = selectedChats.includes(chat.id);

            return (
              <div
                key={chat.id}
                className={`forward-chat-item ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleChat(chat.id)}
              >
                <div className="forward-chat-avatar">
                  {pic ? (
                    <img src={pic} alt="" className="avatar" />
                  ) : (
                    <div className="avatar-placeholder">
                      {chat.type === 'group' ? '👥' : name?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="forward-chat-name">{name}</div>
                <div className={`forward-check ${isSelected ? 'checked' : ''}`}>
                  {isSelected && <BsCheck2 />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Forward button */}
        {selectedChats.length > 0 && (
          <div className="forward-dialog-footer">
            <button className="forward-send-btn" onClick={handleForward} disabled={forwarding}>
              <FiSend /> {forwarding ? 'Forwarding...' : 'Forward'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
