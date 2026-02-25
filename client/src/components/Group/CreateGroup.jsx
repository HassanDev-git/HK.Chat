import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useChat } from '../../context/ChatContext';
import { FiArrowLeft, FiArrowRight, FiSearch, FiCheck } from 'react-icons/fi';

export default function CreateGroup() {
  const { setView, createGroup } = useChat();
  const [step, setStep] = useState(1); // 1: select members, 2: group info
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await API.get('/users');
      setAllUsers(res.data.users);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const filteredUsers = allUsers.filter(u =>
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.unique_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (user) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setLoading(true);
    try {
      await createGroup(
        groupName.trim(),
        groupDesc.trim(),
        selectedUsers.map(u => u.id)
      );
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="sidebar create-group-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setStep(1)}>
            <FiArrowLeft />
          </button>
          <h3>New Group</h3>
        </div>

        <div className="group-info-form">
          <div className="group-pic-placeholder">
            <span>👥</span>
          </div>

          <div className="input-group">
            <input
              type="text"
              placeholder="Group name (required)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={25}
              autoFocus
            />
          </div>

          <div className="input-group">
            <input
              type="text"
              placeholder="Group description (optional)"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="selected-members-preview">
            <h5>Members: {selectedUsers.length}</h5>
            <div className="member-chips">
              {selectedUsers.map(u => (
                <div key={u.id} className="member-chip">
                  <div className="avatar-tiny">
                    {u.profile_pic ? <img src={u.profile_pic} alt="" /> : <span>{u.display_name[0]}</span>}
                  </div>
                  <span>{u.display_name}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="create-group-btn" onClick={handleCreate} disabled={!groupName.trim() || loading}>
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar create-group-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => setView('chats')}>
          <FiArrowLeft />
        </button>
        <h3>Add Group Members</h3>
      </div>

      {/* Selected users chips */}
      {selectedUsers.length > 0 && (
        <div className="selected-users-bar">
          {selectedUsers.map(u => (
            <div key={u.id} className="selected-chip" onClick={() => toggleUser(u)}>
              <div className="avatar-tiny">
                {u.profile_pic ? <img src={u.profile_pic} alt="" /> : <span>{u.display_name[0]}</span>}
              </div>
              <span>{u.display_name}</span>
              <FiArrowLeft className="remove-icon" style={{ transform: 'rotate(45deg)' }} />
            </div>
          ))}
        </div>
      )}

      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search contacts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="user-list">
        {filteredUsers.map(u => {
          const isSelected = selectedUsers.find(su => su.id === u.id);
          return (
            <div key={u.id} className={`user-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleUser(u)}>
              <div className="chat-item-avatar">
                {u.profile_pic ? (
                  <img src={u.profile_pic} alt="" className="avatar" />
                ) : (
                  <div className="avatar-placeholder">{u.display_name[0]}</div>
                )}
                {isSelected && <div className="selected-check"><FiCheck /></div>}
              </div>
              <div className="user-item-info">
                <h4>{u.display_name}</h4>
                <p className="user-about">{u.about}</p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedUsers.length > 0 && (
        <button className="fab-btn" onClick={() => setStep(2)}>
          <FiArrowRight />
        </button>
      )}
    </div>
  );
}
