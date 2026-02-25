import React, { useRef, useEffect, useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function ChatWindow() {
  const { activeChat, messages, loadingMessages, sendMessage, typingUsers } = useChat();
  const { user } = useAuth();
  const { emit } = useSocket();
  const [replyTo, setReplyTo] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setReplyTo(null);
  }, [activeChat?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (messageData) => {
    if (replyTo) {
      messageData.reply_to = replyTo.id;
    }
    await sendMessage(activeChat.id, messageData);
    setReplyTo(null);

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

  if (!activeChat) return null;

  const typing = typingUsers[activeChat.id];

  return (
    <div className="chat-window">
      <ChatHeader chat={activeChat} typing={typing} />
      
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
            messagesEndRef={messagesEndRef}
          />
        )}
      </div>

      <MessageInput
        onSend={handleSendMessage}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        chatId={activeChat.id}
      />
    </div>
  );
}
