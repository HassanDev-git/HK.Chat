import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import API from '../api/axios';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { triggerNotification } from '../components/Notification/NotificationToast';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { socket, connected, on, off, emit } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [view, setView] = useState('chats'); // chats, status, settings, profile, newchat, newgroup
  const activeChatRef = useRef(null);
  const notificationSoundRef = useRef(null);
  const showNotificationRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Request notification permission on mount
  useEffect(() => {
    if (user && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // We'll create notification sound lazily on first use (browser requires user interaction for AudioContext)
    notificationSoundRef.current = null;
  }, [user]);

  // Lazily create and play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      if (!notificationSoundRef.current) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) {
          data[i] = Math.sin(2 * Math.PI * 800 * i / audioCtx.sampleRate) * Math.exp(-3 * i / buffer.length);
        }
        notificationSoundRef.current = { audioCtx, buffer };
      }
      const { audioCtx, buffer } = notificationSoundRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (e) {
      console.log('Notification sound error:', e);
    }
  }, []);

  const updateTitleBadge = useCallback(() => {
    const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) HK Chat` : 'HK Chat';
  }, [chats]);

  // Notification helper
  const showNotification = useCallback((message) => {
    // Play notification sound
    playNotificationSound();

    // Build notification text
    const senderName = message.sender_name || 'Someone';
    let body = message.content || '';
    if (message.type === 'image') body = '📷 Photo';
    else if (message.type === 'video') body = '🎥 Video';
    else if (message.type === 'voice') body = '🎤 Voice message';
    else if (message.type === 'audio') body = '🎵 Audio';
    else if (message.type === 'document') body = '📄 Document';

    // In-app toast notification
    triggerNotification({
      senderName,
      text: body,
      chatId: message.chat_id
    });

    // Browser notification (when tab is not focused)
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`HK Chat - ${senderName}`, {
        body,
        icon: '/manifest.json',
        tag: `msg-${message.id}`,
        silent: true // We play our own sound
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    }

    // Update page title with unread count
    updateTitleBadge();
  }, [playNotificationSound, updateTitleBadge]);

  // Keep notification ref in sync
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

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

  // Update title badge when chats change
  useEffect(() => {
    updateTitleBadge();
  }, [chats, updateTitleBadge]);

  // Socket event listeners - use refs to avoid stale closures
  useEffect(() => {
    if (!user || !socket || !connected) return;

    const handleNewMessage = ({ chatId, message }) => {
      const currentActiveChat = activeChatRef.current;
      
      // Update messages if in active chat
      if (currentActiveChat?.id === chatId) {
        setMessages(prev => {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      // Show notification for messages not in active chat
      if (currentActiveChat?.id !== chatId || document.hidden) {
        showNotificationRef.current?.(message);
      }

      // Update chat list
      setChats(prev => {
        const currentActive = activeChatRef.current;
        return prev.map(c => {
          if (c.id === chatId) {
            return {
              ...c,
              lastMessage: message,
              unread_count: currentActive?.id === chatId ? 0 : (c.unread_count || 0) + 1,
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
        // For private chats, fix the otherUser perspective
        let fixedChat = { ...chat };
        if (chat.type === 'private' && chat.members) {
          const other = chat.members.find(m => m.id !== user.id);
          if (other) {
            fixedChat.otherUser = other;
          }
        }
        return [fixedChat, ...prev];
      });
      // Join the chat room
      socket.emit('chat:join', { chatId: chat.id });
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
      if (activeChatRef.current?.id === chatId) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_deleted: 1, content: 'This message was deleted', file_url: null } : m
        ));
      }
    };

    const handleMessageEdited = ({ messageId, chatId, content }) => {
      if (activeChatRef.current?.id === chatId) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, content, is_edited: 1 } : m
        ));
      }
    };

    const handleMessageRead = ({ chatId, userId: readerId }) => {
      if (activeChatRef.current?.id === chatId) {
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

    socket.on('message:receive', handleNewMessage);
    socket.on('chat:new', handleNewChat);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message:read', handleMessageRead);

    return () => {
      socket.off('message:receive', handleNewMessage);
      socket.off('chat:new', handleNewChat);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message:read', handleMessageRead);
    };
  }, [user, socket, connected]);

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
      const forwarded = res.data.messages;
      
      // Emit socket events for each forwarded message
      forwarded.forEach(msg => {
        emit('message:send', { chatId: msg.chat_id, message: msg });
      });

      // Update chat list
      setChats(prev => {
        let updated = [...prev];
        forwarded.forEach(msg => {
          updated = updated.map(c =>
            c.id === msg.chat_id ? { ...c, lastMessage: msg, updated_at: msg.created_at } : c
          );
        });
        return updated.sort((a, b) => {
          if (a.member_pinned && !b.member_pinned) return -1;
          if (!a.member_pinned && b.member_pinned) return 1;
          return new Date(b.updated_at) - new Date(a.updated_at);
        });
      });

      return forwarded;
    } catch (err) {
      console.error('Failed to forward message:', err);
      throw err;
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
