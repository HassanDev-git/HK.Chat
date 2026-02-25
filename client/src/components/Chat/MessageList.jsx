import React from 'react';
import MessageItem from './MessageItem';

export default function MessageList({ messages, currentUser, onReply, messagesEndRef }) {
  // Group messages by date
  const groupedMessages = [];
  let currentDate = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at + 'Z').toLocaleDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ type: 'date', date: msgDate, dateObj: new Date(msg.created_at + 'Z') });
    }
    groupedMessages.push({ type: 'message', data: msg });
  });

  const formatDateLabel = (dateObj) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateObj.toDateString() === today.toDateString()) return 'Today';
    if (dateObj.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="message-list">
      {groupedMessages.map((item, index) => {
        if (item.type === 'date') {
          return (
            <div key={`date-${index}`} className="date-separator">
              <span>{formatDateLabel(item.dateObj)}</span>
            </div>
          );
        }
        return (
          <MessageItem
            key={item.data.id}
            message={item.data}
            isOwn={item.data.sender_id === currentUser.id}
            onReply={onReply}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
