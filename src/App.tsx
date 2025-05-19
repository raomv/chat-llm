import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ChatMessage from './components/ChatMessage';
import './App.css';

// URL del backend - Ajusta según tu configuración
const API_URL = 'http://localhost:8000';

function App() {
  const [messages, setMessages] = useState<{text: string, isUser: boolean}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll al fondo cuando cambian los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Añadir mensaje del usuario
    const userMessage = input;
    setMessages([...messages, { text: userMessage, isUser: true }]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Enviar solicitud al backend FastAPI
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage
      });
      
      // Añadir respuesta de la IA
      setMessages(prev => [...prev, { text: response.data.response, isUser: false }]);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setMessages(prev => [...prev, { 
        text: "Lo siento, ha ocurrido un error al conectar con el servidor. Inténtalo de nuevo más tarde.", 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Chat con IA</h1>
      </header>
      
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>👋 Haz una pregunta para comenzar la conversación</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage 
              key={index} 
              message={msg.text} 
              isUser={msg.isUser} 
            />
          ))
        )}
        {isLoading && (
          <div className="loading-indicator">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu mensaje aquí..."
          disabled={isLoading}
        />
        <button type="submit" disabled={!input.trim() || isLoading}>
          Enviar
        </button>
      </form>
    </div>
  );
}

export default App;
