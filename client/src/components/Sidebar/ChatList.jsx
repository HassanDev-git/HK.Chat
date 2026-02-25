import React from 'react';
import ChatItem from './ChatItem';
import { useChat } from '../../context/ChatContext';

export default function ChatList({ chats, typingUsers }) {
  const { activeChat, openChat } = useChat();

  return (
    <div className="chat-list">
      {chats.map(chat => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={activeChat?.id === chat.id}
          typing={typingUsers[chat.id]}
          onClick={() => openChat(chat)}
        />
      ))}
    </div>
  );
}
