import React, { useState } from 'react';
import API from '../../api/axios';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { FiArrowLeft, FiEdit2, FiCheck, FiX, FiUserPlus, FiLogOut, FiTrash2 } from 'react-icons/fi';
import { BsShieldCheck } from 'react-icons/bs';

export default function GroupInfo() {
  const { activeChat, setView, loadChats, setActiveChat } = useChat();
  const { user } = useAuth();
  const { emit, onlineUsers } = useSocket();
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');

  if (!activeChat || activeChat.type !== 'group') return null;

  const isAdmin = activeChat.members?.find(m => m.id === user.id)?.role === 'admin';

  const handleEditSave = async () => {
    try {
      await API.put(`/chats/group/${activeChat.id}`, { [editField]: editValue });
      emit('group:updated', { chatId: activeChat.id, [editField]: editValue });
      loadChats();
      setEditField(null);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member from the group?')) return;
    try {
      await API.delete(`/chats/group/${activeChat.id}/members/${memberId}`);
      emit('group:memberRemoved', { chatId: activeChat.id, userId: memberId });
      loadChats();
    } catch (err) {
      console.error('Remove failed:', err);
    }
  };

  const leaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    try {
      await API.post(`/chats/group/${activeChat.id}/leave`);
      setActiveChat(null);
      setView('chats');
      loadChats();
    } catch (err) {
      console.error('Leave failed:', err);
    }
  };

  return (
    <div className="sidebar group-info-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => setView('chats')}>
          <FiArrowLeft />
        </button>
        <h3>Group Info</h3>
      </div>

      <div className="group-info-content">
        {/* Group Avatar */}
        <div className="profile-pic-section">
          <div className="profile-pic-large">
            {activeChat.group_pic ? (
              <img src={activeChat.group_pic} alt="" />
            ) : (
              <div className="avatar-placeholder large">👥</div>
            )}
          </div>
        </div>

        {/* Group Name */}
        <div className="profile-field">
          <div className="field-label">Group name</div>
          {editField === 'name' ? (
            <div className="field-edit">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div className="field-edit-actions">
                <button onClick={handleEditSave}><FiCheck /></button>
                <button onClick={() => setEditField(null)}><FiX /></button>
              </div>
            </div>
          ) : (
            <div className="field-value" onClick={() => isAdmin && (setEditField('name'), setEditValue(activeChat.name || ''))}>
              <span>{activeChat.name}</span>
              {isAdmin && <FiEdit2 className="edit-icon" />}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="profile-field">
          <div className="field-label">Description</div>
          {editField === 'description' ? (
            <div className="field-edit">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
              <div className="field-edit-actions">
                <button onClick={handleEditSave}><FiCheck /></button>
                <button onClick={() => setEditField(null)}><FiX /></button>
              </div>
            </div>
          ) : (
            <div className="field-value" onClick={() => isAdmin && (setEditField('description'), setEditValue(activeChat.description || ''))}>
              <span>{activeChat.description || 'No description'}</span>
              {isAdmin && <FiEdit2 className="edit-icon" />}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="group-members-section">
          <div className="section-header">
            <h5>{activeChat.members?.length || 0} Members</h5>
          </div>

          <div className="member-list">
            {activeChat.members?.sort((a, b) => {
              if (a.role === 'admin' && b.role !== 'admin') return -1;
              if (a.role !== 'admin' && b.role === 'admin') return 1;
              return 0;
            }).map(member => (
              <div key={member.id} className="member-item">
                <div className="chat-item-avatar">
                  {member.profile_pic ? (
                    <img src={member.profile_pic} alt="" className="avatar" />
                  ) : (
                    <div className="avatar-placeholder">{member.display_name[0]}</div>
                  )}
                  {onlineUsers.has(member.id) && <div className="online-dot" />}
                </div>
                <div className="member-info">
                  <h4>{member.display_name} {member.id === user.id ? '(You)' : ''}</h4>
                  <p>{member.unique_id}</p>
                </div>
                <div className="member-actions">
                  {member.role === 'admin' && <span className="admin-badge"><BsShieldCheck /> Admin</span>}
                  {isAdmin && member.id !== user.id && (
                    <button className="icon-btn danger-btn" onClick={() => removeMember(member.id)} title="Remove">
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="group-actions">
          <button className="group-action-btn danger" onClick={leaveGroup}>
            <FiLogOut /> Exit Group
          </button>
        </div>
      </div>
    </div>
  );
}
