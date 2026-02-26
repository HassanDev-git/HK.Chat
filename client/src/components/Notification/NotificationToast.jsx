import React, { useState, useEffect, useCallback } from 'react';
import { FiX } from 'react-icons/fi';

let addNotificationFn = null;

// Global function to show notifications from anywhere
export function triggerNotification(notification) {
  if (addNotificationFn) {
    addNotificationFn(notification);
  }
}

export default function NotificationToast({ onClickNotification }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { ...notification, id }]);
    // Auto remove after 4 seconds
    setTimeout(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, hiding: true } : n));
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 300);
    }, 4000);
  }, []);

  useEffect(() => {
    addNotificationFn = addNotification;
    return () => { addNotificationFn = null; };
  }, [addNotification]);

  const removeNotification = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, hiding: true } : n));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 300);
  };

  const handleClick = (notification) => {
    removeNotification(notification.id);
    if (onClickNotification) {
      onClickNotification(notification);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map(n => (
        <div 
          key={n.id} 
          className={`notification-toast ${n.hiding ? 'hiding' : ''}`}
          onClick={() => handleClick(n)}
        >
          <div className="notification-avatar">
            {n.senderName ? n.senderName[0].toUpperCase() : '?'}
          </div>
          <div className="notification-body">
            <div className="notification-sender">{n.senderName || 'New Message'}</div>
            <div className="notification-text">{n.text}</div>
          </div>
          <button 
            className="notification-close" 
            onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
          >
            <FiX />
          </button>
        </div>
      ))}
    </div>
  );
}
