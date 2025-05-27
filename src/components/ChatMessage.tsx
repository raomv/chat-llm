import { useState } from 'react';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
}

interface ProcessedMessage {
  hasThinking: boolean;
  thinkingContent: string;
  mainContent: string;
}

function ChatMessage({ message, isUser }: ChatMessageProps) {
  const [showThinking, setShowThinking] = useState(false);

  // Función para procesar el mensaje y extraer el contenido de pensamiento
  const processMessage = (text: string): ProcessedMessage => {
    // Detectar múltiples tipos de etiquetas de pensamiento
    const patterns = [
      /<think>(.*?)<\/think>/s,
      /<reasoning>(.*?)<\/reasoning>/s,
      /<analysis>(.*?)<\/analysis>/s
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          hasThinking: true,
          thinkingContent: match[1].trim(),
          mainContent: text.replace(pattern, '').trim()
        };
      }
    }
    
    return {
      hasThinking: false,
      thinkingContent: '',
      mainContent: text
    };
  };

  const processed = processMessage(message);

  return (
    <div className={`message ${isUser ? 'user-message' : 'ai-message'}`}>
      <div className="message-content">
        {/* Mostrar contenido principal */}
        <div className="main-response">
          {processed.mainContent}
        </div>
        
        {/* Mostrar toggle para pensamiento si existe */}
        {processed.hasThinking && !isUser && (
          <div className="thinking-section">
            <button 
              className="thinking-toggle"
              onClick={() => setShowThinking(!showThinking)}
            >
              💭 {showThinking ? 'Ocultar' : 'Mostrar'} razonamiento
            </button>
            
            {showThinking && (
              <div className="thinking-content">
                {processed.thinkingContent}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;