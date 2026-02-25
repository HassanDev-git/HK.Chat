import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import ChatList from './ChatList';
import { FiMessageCircle, FiCircle, FiMoreVertical, FiSearch, FiUsers, FiSettings, FiLogOut, FiUser } from 'react-icons/fi';
import { BsChatDots, BsThreeDotsVertical } from 'react-icons/bs';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { setView, chats, loadingChats, typingUsers } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread, groups

  const filteredChats = chats.filter(chat => {
    if (chat.member_archived) return false;
    
    // Search filter
    if (searchQuery) {
      const name = chat.type === 'private' 
        ? chat.otherUser?.display_name 
        : chat.name;
      if (!name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }

    // Tab filter
    if (filter === 'unread' && !chat.unread_count) return false;
    if (filter === 'groups' && chat.type !== 'group') return false;

    return true;
  });

  const archivedCount = chats.filter(c => c.member_archived).length;

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <div className="avatar-small clickable" onClick={() => setView('profile')}>
            {user?.profile_pic ? (
              <img src={user.profile_pic} alt="" />
            ) : (
              <div className="avatar-placeholder">{user?.display_name?.[0]}</div>
            )}
          </div>
          <h3>{user?.display_name}</h3>
        </div>
        <div className="sidebar-header-actions">
          <button className="icon-btn" title="Status" onClick={() => setView('status')}>
            <FiCircle />
          </button>
          <button className="icon-btn" title="New Chat" onClick={() => setView('newchat')}>
            <FiMessageCircle />
          </button>
          <div className="dropdown-container">
            <button className="icon-btn" onClick={() => setShowMenu(!showMenu)}>
              <BsThreeDotsVertical />
            </button>
            {showMenu && (
              <div className="dropdown-menu" onClick={() => setShowMenu(false)}>
                <button onClick={() => setView('newgroup')}><FiUsers /> New Group</button>
                <button onClick={() => setView('status')}><FiCircle /> Status</button>
                <button onClick={() => setView('settings')}><FiSettings /> Settings</button>
                <button onClick={() => setView('profile')}><FiUser /> Profile</button>
                <hr />
                <button onClick={logout} className="danger"><FiLogOut /> Log Out</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="sidebar-filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-btn ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread</button>
        <button className={`filter-btn ${filter === 'groups' ? 'active' : ''}`} onClick={() => setFilter('groups')}>Groups</button>
      </div>

      {/* Chat List */}
      <div className="sidebar-chats">
        {loadingChats ? (
          <div className="loading-state">
            <div className="loading-spinner small"></div>
            <p>Loading chats...</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="empty-state">
            <BsChatDots size={48} />
            <p>{searchQuery ? 'No chats found' : 'No conversations yet'}</p>
            <button className="start-chat-btn" onClick={() => setView('newchat')}>Start New Chat</button>
          </div>
        ) : (
          <ChatList chats={filteredChats} typingUsers={typingUsers} />
        )}

        {archivedCount > 0 && !searchQuery && (
          <div className="archived-chats-link">
            <span>📦 Archived ({archivedCount})</span>
          </div>
        )}
      </div>
    </div>
  );
}
