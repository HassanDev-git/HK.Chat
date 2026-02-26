import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { FiArrowLeft, FiEdit2, FiCheck, FiX, FiUserPlus, FiLogOut, FiTrash2, FiCopy, FiLink, FiSearch } from 'react-icons/fi';
import { BsShieldCheck } from 'react-icons/bs';

export default function GroupInfo() {
  const { activeChat, setView, loadChats, setActiveChat } = useChat();
  const { user } = useAuth();
  const { emit, onlineUsers } = useSocket();
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [inviteCode, setInviteCode] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!activeChat || activeChat.type !== 'group') return null;

  const isAdmin = activeChat.members?.find(m => m.id === user.id)?.role === 'admin';
  const currentMemberIds = activeChat.members?.map(m => m.id) || [];

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

  // Load users for add members
  const loadUsersForAdd = async () => {
    try {
      const res = await API.get('/users');
      setAllUsers(res.data.users.filter(u => !currentMemberIds.includes(u.id)));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const toggleUserSelect = (u) => {
    setSelectedUsers(prev =>
      prev.find(su => su.id === u.id)
        ? prev.filter(su => su.id !== u.id)
        : [...prev, u]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    setAddingMembers(true);
    try {
      const res = await API.post(`/chats/group/${activeChat.id}/members/bulk`, {
        userIds: selectedUsers.map(u => u.id)
      });
      // Notify via socket
      res.data.addedUsers?.forEach(userId => {
        emit('group:memberAdded', { chatId: activeChat.id, userId });
      });
      // Reload chats and refresh activeChat with new members
      const chatsRes = await API.get('/chats');
      const updatedChat = chatsRes.data.chats.find(c => c.id === activeChat.id);
      if (updatedChat) {
        setActiveChat(prev => ({ ...prev, members: updatedChat.members || prev.members }));
      }
      loadChats();
      setShowAddMembers(false);
      setSelectedUsers([]);
      setSearchQuery('');
    } catch (err) {
      console.error('Add members failed:', err);
      alert(err.response?.data?.error || 'Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  // Invite link functions
  const loadInviteLink = async () => {
    setInviteLoading(true);
    try {
      const res = await API.get(`/chats/group/${activeChat.id}/invite`);
      setInviteCode(res.data.invite?.invite_code || null);
    } catch (err) {
      console.error('Failed to load invite:', err);
    } finally {
      setInviteLoading(false);
    }
  };

  const generateInviteLink = async () => {
    setInviteLoading(true);
    try {
      const res = await API.post(`/chats/group/${activeChat.id}/invite`);
      setInviteCode(res.data.invite.invite_code);
    } catch (err) {
      console.error('Failed to generate invite:', err);
      alert('Failed to generate invite link');
    } finally {
      setInviteLoading(false);
    }
  };

  const revokeInviteLink = async () => {
    if (!confirm('Revoke this invite link? Anyone with the old link will no longer be able to join.')) return;
    try {
      await API.delete(`/chats/group/${activeChat.id}/invite`);
      setInviteCode(null);
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const filteredUsersForAdd = allUsers.filter(u =>
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.unique_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add Members Panel
  if (showAddMembers) {
    return (
      <div className="sidebar group-info-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => { setShowAddMembers(false); setSelectedUsers([]); setSearchQuery(''); }}>
            <FiArrowLeft />
          </button>
          <h3>Add Members</h3>
          {selectedUsers.length > 0 && (
            <button className="icon-btn" onClick={handleAddMembers} disabled={addingMembers} style={{ color: 'var(--accent)' }}>
              <FiCheck />
            </button>
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="selected-users-bar">
            {selectedUsers.map(u => (
              <div key={u.id} className="selected-chip" onClick={() => toggleUserSelect(u)}>
                <div className="avatar-tiny">
                  {u.profile_pic ? <img src={u.profile_pic} alt="" /> : <span>{u.display_name[0]}</span>}
                </div>
                <span>{u.display_name}</span>
                <FiX className="remove-icon" />
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-search">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search users to add"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="user-list">
          {filteredUsersForAdd.map(u => {
            const isSelected = selectedUsers.find(su => su.id === u.id);
            return (
              <div key={u.id} className={`user-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleUserSelect(u)}>
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
          {filteredUsersForAdd.length === 0 && (
            <div className="loading-state" style={{ padding: '30px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No users to add</p>
            </div>
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="add-members-footer">
            <button className="create-group-btn" onClick={handleAddMembers} disabled={addingMembers}>
              {addingMembers ? 'Adding...' : `Add ${selectedUsers.length} Member${selectedUsers.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Invite Link Panel
  if (showInviteLink) {
    return (
      <div className="sidebar group-info-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setShowInviteLink(false)}>
            <FiArrowLeft />
          </button>
          <h3>Invite Link</h3>
        </div>

        <div className="invite-link-content">
          <div className="invite-info-box">
            <FiLink className="invite-big-icon" />
            <h4>Group Invite Link</h4>
            <p>Share this link to let people join your group. Only admins can generate or revoke links.</p>
          </div>

          {inviteCode ? (
            <div className="invite-link-box">
              <div className="invite-link-url">
                <span>{`${window.location.origin}/join/${inviteCode}`}</span>
              </div>
              <div className="invite-link-actions">
                <button className="invite-action-btn copy" onClick={copyInviteLink}>
                  <FiCopy /> {copiedLink ? 'Copied!' : 'Copy Link'}
                </button>
                {isAdmin && (
                  <button className="invite-action-btn revoke" onClick={revokeInviteLink}>
                    <FiTrash2 /> Revoke Link
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="invite-link-box">
              {isAdmin ? (
                <button className="create-group-btn" onClick={generateInviteLink} disabled={inviteLoading}>
                  {inviteLoading ? 'Generating...' : 'Generate Invite Link'}
                </button>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                  No active invite link. Ask an admin to generate one.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

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

        {/* Invite & Add Members Actions */}
        <div className="group-invite-actions">
          {isAdmin && (
            <button className="group-action-btn" onClick={() => { setShowAddMembers(true); loadUsersForAdd(); }}>
              <FiUserPlus /> Add Members
            </button>
          )}
          <button className="group-action-btn" onClick={() => { setShowInviteLink(true); loadInviteLink(); }}>
            <FiLink /> Invite Link
          </button>
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
