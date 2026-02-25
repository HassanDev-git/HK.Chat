import React, { useState, useRef } from 'react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { FiArrowLeft, FiCamera, FiEdit2, FiCheck, FiX, FiMail, FiHash, FiCalendar } from 'react-icons/fi';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { setView } = useChat();
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleEditStart = (field, value) => {
    setEditField(field);
    setEditValue(value || '');
  };

  const handleEditSave = async () => {
    if (!editField) return;
    try {
      await updateProfile({ [editField]: editValue });
      setEditField(null);
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await API.post('/upload?type=profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await updateProfile({ profile_pic: res.data.url });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sidebar profile-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => setView('chats')}>
          <FiArrowLeft />
        </button>
        <h3>Profile</h3>
      </div>

      <div className="profile-content">
        {/* Profile Picture */}
        <div className="profile-pic-section">
          <div className="profile-pic-large" onClick={() => fileInputRef.current?.click()}>
            {user?.profile_pic ? (
              <img src={user.profile_pic} alt="" />
            ) : (
              <div className="avatar-placeholder large">{user?.display_name?.[0]}</div>
            )}
            <div className="profile-pic-overlay">
              <FiCamera />
              <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleProfilePicUpload} />
        </div>

        {/* Name */}
        <div className="profile-field">
          <div className="field-label">Your name</div>
          {editField === 'display_name' ? (
            <div className="field-edit">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={25}
                autoFocus
              />
              <div className="field-edit-actions">
                <button onClick={handleEditSave}><FiCheck /></button>
                <button onClick={() => setEditField(null)}><FiX /></button>
              </div>
            </div>
          ) : (
            <div className="field-value" onClick={() => handleEditStart('display_name', user?.display_name)}>
              <span>{user?.display_name}</span>
              <FiEdit2 className="edit-icon" />
            </div>
          )}
        </div>

        {/* About */}
        <div className="profile-field">
          <div className="field-label">About</div>
          {editField === 'about' ? (
            <div className="field-edit">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={139}
                autoFocus
              />
              <div className="field-edit-actions">
                <button onClick={handleEditSave}><FiCheck /></button>
                <button onClick={() => setEditField(null)}><FiX /></button>
              </div>
            </div>
          ) : (
            <div className="field-value" onClick={() => handleEditStart('about', user?.about)}>
              <span>{user?.about || 'Hey there! I am using HK Chat'}</span>
              <FiEdit2 className="edit-icon" />
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="profile-field">
          <div className="field-label">Phone</div>
          {editField === 'phone' ? (
            <div className="field-edit">
              <input
                type="tel"
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
            <div className="field-value" onClick={() => handleEditStart('phone', user?.phone)}>
              <span>{user?.phone || 'Add phone number'}</span>
              <FiEdit2 className="edit-icon" />
            </div>
          )}
        </div>

        {/* Read-only info */}
        <div className="profile-field readonly">
          <div className="field-label"><FiMail /> Email</div>
          <div className="field-value">
            <span>{user?.email}</span>
          </div>
        </div>

        <div className="profile-field readonly">
          <div className="field-label"><FiHash /> Unique ID</div>
          <div className="field-value">
            <span className="unique-id">{user?.unique_id}</span>
          </div>
        </div>

        <div className="profile-field readonly">
          <div className="field-label"><FiCalendar /> Joined</div>
          <div className="field-value">
            <span>{user?.created_at ? new Date(user.created_at + 'Z').toLocaleDateString() : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
