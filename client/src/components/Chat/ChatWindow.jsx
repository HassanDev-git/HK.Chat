import React, { useRef, useEffect, useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ForwardDialog from './ForwardDialog';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import API from '../../api/axios';

export default function ChatWindow() {
  const { activeChat, messages, loadingMessages, sendMessage, typingUsers } = useChat();
  const { user } = useAuth();
  const { emit } = useSocket();
  const [replyTo, setReplyTo] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [blockStatus, setBlockStatus] = useState({ iBlockedThem: false, theyBlockedMe: false });
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setReplyTo(null);
    setBlockStatus({ iBlockedThem: false, theyBlockedMe: false });
    // Check block status for private chats
    if (activeChat?.type === 'private' && activeChat.otherUser) {
      API.get(`/users/blocked/check/${activeChat.otherUser.id}`)
        .then(res => setBlockStatus(res.data))
        .catch(() => {});
    }
  }, [activeChat?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageData) => {
    if (replyTo) {
      messageData.reply_to = replyTo.id;
    }
    try {
      await sendMessage(activeChat.id, messageData);
      setReplyTo(null);
    } catch (err) {
      if (err.response?.status === 403) {
        alert(err.response.data.error || 'Cannot send message');
      }
      return;
    }

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emit('typing:stop', { chatId: activeChat.id });
  };

  const handleTyping = () => {
    emit('typing:start', { chatId: activeChat.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emit('typing:stop', { chatId: activeChat.id });
    }, 2000);
  };

  const handleBlockStatusChange = (newStatus) => {
    setBlockStatus(newStatus);
  };

  if (!activeChat) return null;

  const typing = typingUsers[activeChat.id];
  const isBlocked = blockStatus.iBlockedThem || blockStatus.theyBlockedMe;

  return (
    <div className="chat-window">
      <ChatHeader chat={activeChat} typing={typing} onBlockStatusChange={handleBlockStatusChange} blockStatus={blockStatus} />
      
      <div className="messages-container">
        {loadingMessages ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUser={user}
            onReply={setReplyTo}
            onForward={setForwardMessage}
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>

      {isBlocked ? (
        <div className="blocked-bar">
          {blockStatus.iBlockedThem 
            ? '🚫 You blocked this user. Unblock from chat menu to send messages.'
            : '🚫 You cannot send messages to this user.'}
        </div>
      ) : (
        <MessageInput
          onSend={handleSendMessage}
          onTyping={handleTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          chatId={activeChat.id}
        />
      )}

      {forwardMessage && (
        <ForwardDialog
          message={forwardMessage}
          onClose={() => setForwardMessage(null)}
        />
      )}
    </div>
  );
}
