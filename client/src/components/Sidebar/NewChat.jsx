import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useChat } from '../../context/ChatContext';
import { FiArrowLeft, FiSearch, FiUserPlus } from 'react-icons/fi';

export default function NewChat() {
  const { setView, startPrivateChat } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const timer = setTimeout(() => searchUsers(), 300);
      return () => clearTimeout(timer);
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
      setUsers(res.data.users);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (userId) => {
    try {
      await startPrivateChat(userId);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  return (
    <div className="sidebar new-chat-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => setView('chats')}>
          <FiArrowLeft />
        </button>
        <h3>New Chat</h3>
      </div>

      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name or @unique_id"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="new-chat-actions">
        <button className="new-chat-action-btn" onClick={() => setView('newgroup')}>
          <div className="action-icon"><FiUserPlus /></div>
          <span>New Group</span>
        </button>
      </div>

      <div className="user-list">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner small"></div>
          </div>
        ) : searchQuery && users.length === 0 ? (
          <div className="empty-state">
            <p>No users found for "{searchQuery}"</p>
          </div>
        ) : (
          users.map(u => (
            <div key={u.id} className="user-item" onClick={() => handleStartChat(u.id)}>
              <div className="chat-item-avatar">
                {u.profile_pic ? (
                  <img src={u.profile_pic} alt="" className="avatar" />
                ) : (
                  <div className="avatar-placeholder">{u.display_name[0]}</div>
                )}
                {u.is_online ? <div className="online-dot" /> : null}
              </div>
              <div className="user-item-info">
                <h4>{u.display_name}</h4>
                <p className="user-unique-id">{u.unique_id}</p>
                <p className="user-about">{u.about}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
