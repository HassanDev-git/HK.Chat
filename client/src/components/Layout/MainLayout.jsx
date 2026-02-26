import React from 'react';
import Sidebar from '../Sidebar/Sidebar';
import ChatWindow from '../Chat/ChatWindow';
import Profile from '../Profile/Profile';
import Settings from '../Settings/Settings';
import StatusPage from '../Status/StatusPage';
import NewChat from '../Sidebar/NewChat';
import CreateGroup from '../Group/CreateGroup';
import GroupInfo from '../Group/GroupInfo';
import NotificationToast from '../Notification/NotificationToast';
import CallScreen from '../Call/CallScreen';
import { useChat } from '../../context/ChatContext';
import { useCall } from '../../context/CallContext';

export default function MainLayout() {
  const { activeChat, view, openChat, chats, setView } = useChat();
  const { callState } = useCall();

  const handleNotificationClick = (notification) => {
    if (notification.chatId) {
      const chat = chats.find(c => c.id === notification.chatId);
      if (chat) {
        openChat(chat);
        setView('chats');
      }
    }
  };

  const renderSidePanel = () => {
    switch (view) {
      case 'profile': return <Profile />;
      case 'settings': return <Settings />;
      case 'status': return <StatusPage />;
      case 'newchat': return <NewChat />;
      case 'newgroup': return <CreateGroup />;
      case 'groupinfo': return <GroupInfo />;
      default: return <Sidebar />;
    }
  };

  return (
    <div className="main-layout">
      <NotificationToast onClickNotification={handleNotificationClick} />
      {callState !== 'idle' && <CallScreen />}
      <div className="side-panel">
        {renderSidePanel()}
      </div>
      <div className="chat-panel">
        {activeChat ? (
          <ChatWindow />
        ) : (
          <div className="no-chat-selected">
            <div className="no-chat-content">
              <div className="no-chat-icon">
                <svg viewBox="0 0 303 172" width="250">
                  <path fill="#DAF7C5" d="M229.565 160.229c32.647-16.166 55.471-51.907 53.711-90.686-1.76-38.78-24.582-64.106-57.291-79.392-32.71-15.287-82.552-14.287-119.737.766-37.186 15.052-60.16 42.917-56.92 76.779 3.239 33.861 27.516 54.648 42.877 70.358 15.36 15.71 26.459 26.996 47.268 34.957 20.809 7.962 57.445 3.383 90.092-12.782Z"/>
                  <path fill="#128C7E" d="M151.5 16C97.844 16 54 51.656 54 95.5c0 23.03 11.406 43.813 29.5 58.563L78 172l22.75-11.375C112.156 165.563 131.188 169 151.5 169 205.156 169 249 133.344 249 95.5S205.156 16 151.5 16Z"/>
                  <path fill="white" d="M115 80h72v6h-72zm0 20h48v6h-48z"/>
                </svg>
              </div>
              <h2>HK Chat Web</h2>
              <p>Send and receive messages. Start a conversation by selecting a chat or searching for users.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
