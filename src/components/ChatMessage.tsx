import React from 'react';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isUser }) => {
  return (
    <div className={`message ${isUser ? 'user-message' : 'ai-message'}`}>
      <div className="message-content">
        <p>{message}</p>
      </div>
    </div>
  );
};

export default ChatMessage;