import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import API from '../../api/axios';
import { FiArrowLeft, FiUser, FiLock, FiBell, FiMonitor, FiHelpCircle, FiInfo, FiChevronRight, FiMoon, FiSun, FiTrash2 } from 'react-icons/fi';
import { BsShieldLock, BsChatDots, BsKeyboard, BsShieldExclamation } from 'react-icons/bs';

export default function Settings() {
  const { user, settings, updateSettings, logout } = useAuth();
  const { setView, loadChats } = useChat();
  const [activeSection, setActiveSection] = useState(null);

  const handleSettingChange = async (key, value) => {
    try {
      await updateSettings({ [key]: value });
    } catch (err) {
      console.error('Settings update failed:', err);
    }
  };

  const toggleTheme = () => {
    const newTheme = settings?.theme === 'dark' ? 'light' : 'dark';
    handleSettingChange('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    if (settings?.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings?.theme]);

  if (activeSection === 'privacy') {
    return (
      <div className="sidebar settings-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setActiveSection(null)}>
            <FiArrowLeft />
          </button>
          <h3>Privacy</h3>
        </div>
        <div className="settings-content">
          <div className="settings-group">
            <h4>Who can see my info</h4>
            <div className="setting-item">
              <span>Last Seen</span>
              <select value={settings?.last_seen_visibility || 'everyone'} onChange={(e) => handleSettingChange('last_seen_visibility', e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <div className="setting-item">
              <span>Profile Photo</span>
              <select value={settings?.profile_photo_visibility || 'everyone'} onChange={(e) => handleSettingChange('profile_photo_visibility', e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <div className="setting-item">
              <span>About</span>
              <select value={settings?.about_visibility || 'everyone'} onChange={(e) => handleSettingChange('about_visibility', e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <div className="setting-item toggle">
              <span>Read Receipts</span>
              <label className="switch">
                <input type="checkbox" checked={settings?.read_receipts === 1} onChange={(e) => handleSettingChange('read_receipts', e.target.checked ? 1 : 0)} />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'notifications') {
    return (
      <div className="sidebar settings-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setActiveSection(null)}>
            <FiArrowLeft />
          </button>
          <h3>Notifications</h3>
        </div>
        <div className="settings-content">
          <div className="settings-group">
            <div className="setting-item toggle">
              <span>Notifications</span>
              <label className="switch">
                <input type="checkbox" checked={settings?.notifications === 1} onChange={(e) => handleSettingChange('notifications', e.target.checked ? 1 : 0)} />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <span>Notification Sound</span>
              <select value={settings?.notification_sound || 'default'} onChange={(e) => handleSettingChange('notification_sound', e.target.value)}>
                <option value="default">Default</option>
                <option value="chime">Chime</option>
                <option value="bell">Bell</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'chat_settings') {
    return (
      <div className="sidebar settings-panel">
        <div className="sidebar-header">
          <button className="icon-btn" onClick={() => setActiveSection(null)}>
            <FiArrowLeft />
          </button>
          <h3>Chat Settings</h3>
        </div>
        <div className="settings-content">
          <div className="settings-group">
            <div className="setting-item">
              <span>Theme</span>
              <select value={settings?.theme || 'light'} onChange={(e) => handleSettingChange('theme', e.target.value)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="setting-item">
              <span>Font Size</span>
              <select value={settings?.font_size || 'medium'} onChange={(e) => handleSettingChange('font_size', e.target.value)}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="setting-item toggle">
              <span>Enter to Send</span>
              <label className="switch">
                <input type="checkbox" checked={settings?.enter_to_send === 1} onChange={(e) => handleSettingChange('enter_to_send', e.target.checked ? 1 : 0)} />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <span>Media Auto-Download</span>
              <select value={settings?.media_auto_download || 'wifi'} onChange={(e) => handleSettingChange('media_auto_download', e.target.value)}>
                <option value="wifi">WiFi only</option>
                <option value="always">Always</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
          <div className="settings-group">
            <h4>Danger Zone</h4>
            <button className="setting-item danger-btn" onClick={async () => {
              if (!window.confirm('Are you sure you want to delete ALL your chats? This cannot be undone.')) return;
              try {
                await API.delete('/chats/all/clear');
                loadChats();
                alert('All chats have been cleared.');
              } catch (err) {
                console.error('Delete all chats failed:', err);
                alert('Failed to delete chats.');
              }
            }}>
              <FiTrash2 />
              <span>Delete All Chats</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'blocked_users') {
    return <BlockedUsersSection onBack={() => setActiveSection(null)} />;
  }

  return (
    <div className="sidebar settings-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={() => setView('chats')}>
          <FiArrowLeft />
        </button>
        <h3>Settings</h3>
      </div>

      {/* User info */}
      <div className="settings-user" onClick={() => setView('profile')}>
        <div className="chat-item-avatar">
          {user?.profile_pic ? (
            <img src={user.profile_pic} alt="" className="avatar" />
          ) : (
            <div className="avatar-placeholder">{user?.display_name?.[0]}</div>
          )}
        </div>
        <div className="settings-user-info">
          <h4>{user?.display_name}</h4>
          <p>{user?.about || 'Hey there! I am using HK Chat'}</p>
        </div>
      </div>

      <div className="settings-content">
        {/* Quick Theme Toggle */}
        <div className="settings-group">
          <div className="setting-item toggle clickable" onClick={toggleTheme}>
            {settings?.theme === 'dark' ? <FiMoon /> : <FiSun />}
            <span>{settings?.theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
            <label className="switch">
              <input type="checkbox" checked={settings?.theme === 'dark'} readOnly />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Settings menu */}
        <div className="settings-menu">
          <button className="settings-menu-item" onClick={() => setView('profile')}>
            <FiUser className="menu-icon" />
            <div className="menu-text">
              <span>Profile</span>
              <p>Profile photo, name, about</p>
            </div>
            <FiChevronRight />
          </button>

          <button className="settings-menu-item" onClick={() => setActiveSection('privacy')}>
            <BsShieldLock className="menu-icon" />
            <div className="menu-text">
              <span>Privacy</span>
              <p>Last seen, profile photo, about</p>
            </div>
            <FiChevronRight />
          </button>

          <button className="settings-menu-item" onClick={() => setActiveSection('notifications')}>
            <FiBell className="menu-icon" />
            <div className="menu-text">
              <span>Notifications</span>
              <p>Message, group notifications</p>
            </div>
            <FiChevronRight />
          </button>

          <button className="settings-menu-item" onClick={() => setActiveSection('chat_settings')}>
            <BsChatDots className="menu-icon" />
            <div className="menu-text">
              <span>Chats</span>
              <p>Theme, wallpaper, font size</p>
            </div>
            <FiChevronRight />
          </button>

          <button className="settings-menu-item" onClick={() => setActiveSection('blocked_users')}>
            <BsShieldExclamation className="menu-icon" />
            <div className="menu-text">
              <span>Blocked Users</span>
              <p>Manage blocked contacts</p>
            </div>
            <FiChevronRight />
          </button>

          <button className="settings-menu-item" onClick={() => setActiveSection('keyboard')}>
            <BsKeyboard className="menu-icon" />
            <div className="menu-text">
              <span>Keyboard Shortcuts</span>
              <p>View keyboard shortcuts</p>
            </div>
            <FiChevronRight />
          </button>

          <button className="settings-menu-item" onClick={() => {}}>
            <FiHelpCircle className="menu-icon" />
            <div className="menu-text">
              <span>Help</span>
              <p>Help center, contact us</p>
            </div>
            <FiChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockedUsersSection({ onBack }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      const res = await API.get('/users/blocked/list');
      setBlockedUsers(res.data.blockedUsers);
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await API.post(`/users/block/${userId}`);
      setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Unblock failed:', err);
    }
  };

  return (
    <div className="sidebar settings-panel">
      <div className="sidebar-header">
        <button className="icon-btn" onClick={onBack}>
          <FiArrowLeft />
        </button>
        <h3>Blocked Users</h3>
      </div>
      <div className="settings-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner small"></div>
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="empty-state">
            <BsShieldExclamation size={48} />
            <p>No blocked users</p>
          </div>
        ) : (
          <div className="blocked-users-list">
            {blockedUsers.map(u => (
              <div key={u.id} className="blocked-user-item">
                <div className="blocked-user-avatar">
                  {u.profile_pic ? (
                    <img src={u.profile_pic} alt="" className="avatar" />
                  ) : (
                    <div className="avatar-placeholder">{u.display_name?.[0]}</div>
                  )}
                </div>
                <div className="blocked-user-info">
                  <span className="blocked-user-name">{u.display_name}</span>
                  <span className="blocked-user-id">{u.unique_id}</span>
                </div>
                <button className="unblock-btn" onClick={() => handleUnblock(u.id)}>
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
