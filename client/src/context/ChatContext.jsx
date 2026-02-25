import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from '../api/axios';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { on, off, emit } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [view, setView] = useState('chats'); // chats, status, settings, profile, newchat, newgroup

  const loadChats = useCallback(async () => {
    if (!user) return;
    setLoadingChats(true);
    try {
      const res = await API.get('/chats');
      setChats(res.data.chats);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoadingChats(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadChats();
  }, [user, loadChats]);

  // Socket event listeners
  useEffect(() => {
    if (!user) return;

    const handleNewMessage = ({ chatId, message }) => {
      // Update messages if in active chat
      if (activeChat?.id === chatId) {
        setMessages(prev => {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
      // Update chat list
      setChats(prev => {
        return prev.map(c => {
          if (c.id === chatId) {
            return {
              ...c,
              lastMessage: message,
              unread_count: activeChat?.id === chatId ? 0 : (c.unread_count || 0) + 1,
              updated_at: message.created_at
            };
          }
          return c;
        }).sort((a, b) => {
          if (a.member_pinned && !b.member_pinned) return -1;
          if (!a.member_pinned && b.member_pinned) return 1;
          return new Date(b.updated_at) - new Date(a.updated_at);
        });
      });
    };

    const handleNewChat = ({ chat }) => {
      setChats(prev => {
        if (prev.find(c => c.id === chat.id)) return prev;
        return [chat, ...prev];
      });
    };

    const handleTypingStart = ({ chatId, userId, userName }) => {
      if (userId === user.id) return;
      setTypingUsers(prev => ({
        ...prev,
        [chatId]: { userId, userName, timestamp: Date.now() }
      }));
      // Clear after 3 seconds
      setTimeout(() => {
        setTypingUsers(prev => {
          const copy = { ...prev };
          if (copy[chatId]?.userId === userId) delete copy[chatId];
          return copy;
        });
      }, 3000);
    };

    const handleTypingStop = ({ chatId, userId }) => {
      setTypingUsers(prev => {
        const copy = { ...prev };
        if (copy[chatId]?.userId === userId) delete copy[chatId];
        return copy;
      });
    };

    const handleMessageDeleted = ({ messageId, chatId }) => {
      if (activeChat?.id === chatId) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_deleted: 1, content: 'This message was deleted', file_url: null } : m
        ));
      }
    };

    const handleMessageEdited = ({ messageId, chatId, content }) => {
      if (activeChat?.id === chatId) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, content, is_edited: 1 } : m
        ));
      }
    };

    const handleMessageRead = ({ chatId, userId: readerId }) => {
      if (activeChat?.id === chatId) {
        setMessages(prev => prev.map(m => {
          if (m.sender_id === user.id) {
            let readBy = typeof m.read_by === 'string' ? JSON.parse(m.read_by || '[]') : (m.read_by || []);
            if (!readBy.includes(readerId)) {
              readBy = [...readBy, readerId];
            }
            return { ...m, read_by: JSON.stringify(readBy) };
          }
          return m;
        }));
      }
    };

    on('message:receive', handleNewMessage);
    on('chat:new', handleNewChat);
    on('typing:start', handleTypingStart);
    on('typing:stop', handleTypingStop);
    on('message:deleted', handleMessageDeleted);
    on('message:edited', handleMessageEdited);
    on('message:read', handleMessageRead);

    return () => {
      off('message:receive', handleNewMessage);
      off('chat:new', handleNewChat);
      off('typing:start', handleTypingStart);
      off('typing:stop', handleTypingStop);
      off('message:deleted', handleMessageDeleted);
      off('message:edited', handleMessageEdited);
      off('message:read', handleMessageRead);
    };
  }, [user, activeChat, on, off]);

  const openChat = async (chat) => {
    setActiveChat(chat);
    setLoadingMessages(true);
    try {
      const res = await API.get(`/messages/${chat.id}`);
      setMessages(res.data.messages);
      // Mark as read
      emit('message:read', { chatId: chat.id });
      // Reset unread
      setChats(prev => prev.map(c =>
        c.id === chat.id ? { ...c, unread_count: 0 } : c
      ));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (chatId, messageData) => {
    try {
      const res = await API.post(`/messages/${chatId}`, messageData);
      const msg = res.data.message;
      setMessages(prev => [...prev, msg]);
      emit('message:send', { chatId, message: msg });
      // Update chat list
      setChats(prev =>
        prev.map(c =>
          c.id === chatId ? { ...c, lastMessage: msg, updated_at: msg.created_at } : c
        ).sort((a, b) => {
          if (a.member_pinned && !b.member_pinned) return -1;
          if (!a.member_pinned && b.member_pinned) return 1;
          return new Date(b.updated_at) - new Date(a.updated_at);
        })
      );
      return msg;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  const startPrivateChat = async (userId) => {
    try {
      const res = await API.post('/chats/private', { userId });
      const chat = res.data.chat;
      if (res.data.created) {
        emit('chat:created', { chat });
      }
      // Add to chats if not exists
      setChats(prev => {
        if (prev.find(c => c.id === chat.id)) return prev;
        return [{ ...chat, lastMessage: null, unread_count: 0 }, ...prev];
      });
      await openChat(chat);
      setView('chats');
      return chat;
    } catch (err) {
      console.error('Failed to start chat:', err);
      throw err;
    }
  };

  const createGroup = async (name, description, members) => {
    try {
      const res = await API.post('/chats/group', { name, description, members });
      const chat = res.data.chat;
      emit('chat:created', { chat });
      setChats(prev => [{ ...chat, lastMessage: null, unread_count: 0 }, ...prev]);
      await openChat(chat);
      setView('chats');
      return chat;
    } catch (err) {
      console.error('Failed to create group:', err);
      throw err;
    }
  };

  const deleteMessage = async (messageId, forEveryone = false) => {
    try {
      await API.delete(`/messages/${messageId}?deleteForEveryone=${forEveryone}`);
      if (forEveryone) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_deleted: 1, content: 'This message was deleted', file_url: null } : m
        ));
        emit('message:delete', { messageId, chatId: activeChat?.id });
      } else {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const editMessage = async (messageId, content) => {
    try {
      const res = await API.put(`/messages/${messageId}`, { content });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...res.data.message, is_edited: 1 } : m
      ));
      emit('message:edit', { messageId, chatId: activeChat?.id, content });
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const starMessage = async (messageId) => {
    try {
      const res = await API.put(`/messages/${messageId}/star`);
      return res.data.starred;
    } catch (err) {
      console.error('Failed to star message:', err);
    }
  };

  const forwardMessage = async (messageId, chatIds) => {
    try {
      const res = await API.post(`/messages/${messageId}/forward`, { chatIds });
      return res.data.messages;
    } catch (err) {
      console.error('Failed to forward message:', err);
    }
  };

  return (
    <ChatContext.Provider value={{
      chats, activeChat, messages, typingUsers,
      loadingChats, loadingMessages, view,
      setView, setActiveChat, loadChats, openChat,
      sendMessage, startPrivateChat, createGroup,
      deleteMessage, editMessage, starMessage, forwardMessage,
      setMessages
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
