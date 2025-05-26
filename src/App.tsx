import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ChatMessage from './components/ChatMessage';
import DocumentManager from './components/DocumentManager';
import './App.css';

// URL del backend - Ajusta según tu configuración
const API_URL = 'http://localhost:8000';

function App() {
  const [messages, setMessages] = useState<{text: string, isUser: boolean}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [comparisonResults, setComparisonResults] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showDocumentManager, setShowDocumentManager] = useState(false);
  // Nuevo estado para el tema
  const [darkMode, setDarkMode] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const [currentCollection, setCurrentCollection] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar la preferencia de tema al iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      setDarkMode(savedTheme === 'true');
    } else {
      // Opcionalmente, detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, []);

  // Aplicar el tema cuando cambia
  useEffect(() => {
    document.body.classList.toggle('dark-theme', darkMode);
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Cargar la lista de modelos al iniciar
  useEffect(() => {
    const fetchModels = async () => {
      try {
        console.log("Solicitando modelos al backend...");
        const response = await axios.get(`${API_URL}/api/models`);
        console.log("Respuesta recibida:", response.data);
        
        if (response.data.models && Array.isArray(response.data.models)) {
          setModels(response.data.models);
          console.log("Modelos cargados:", response.data.models);
          
          // Preseleccionar el modelo por defecto
          if (response.data.default_model) {
            setSelectedModels([response.data.default_model]);
          } else if (response.data.models.length > 0) {
            setSelectedModels([response.data.models[0]]);
          }
        } else {
          console.error('Formato de respuesta inválido:', response.data);
          // Añadir un valor predeterminado para que se muestre algo
          setModels(["No se pudieron cargar los modelos"]);
        }
      } catch (error) {
        console.error('Error al cargar modelos:', error);
        // Agregar un valor por defecto para que se muestre algo
        setModels(["Error de conexión"]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  // Cargar colecciones disponibles
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/collections`);
        setCollections(response.data.collections);
        setCurrentCollection(response.data.current);
      } catch (error) {
        console.error('Error al cargar colecciones:', error);
      }
    };
    
    fetchCollections();
  }, []);

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

  // Agregar la función de comparación aquí
  const compareModels = async () => {
    if (!input.trim()) return;
    
    // Mostrar panel de comparación
    setShowComparison(true);
    setIsComparing(true);
    
    console.log("Enviando solicitud de comparación con modelos:", selectedModels);
    
    try {
      // Enviar solicitud para comparar modelos
      const response = await axios.post(`${API_URL}/compare-models`, {
        message: input,
        models: selectedModels.length > 0 ? selectedModels : undefined
      });
      
      console.log("Respuesta de comparación recibida:", response.data);
      
      // Guardar resultados de la comparación
      setComparisonResults(response.data.results);
      setMetrics(response.data.metrics);
    } catch (error) {
      console.error('Error al comparar modelos:', error);
      setComparisonResults({
        error: "Lo siento, ha ocurrido un error al comparar los modelos."
      });
    } finally {
      setIsComparing(false);
    }
  };

  const handleModelSelection = (model: string) => {
    setSelectedModels(prev => {
      // Si ya está seleccionado, quitarlo
      if (prev.includes(model)) {
        return prev.filter(m => m !== model);
      }
      // Si no está seleccionado, añadirlo
      return [...prev, model];
    });
  };

  const renderMetricBar = (value: number | null, label: string) => {
    if (value === null) return <div>Métrica no disponible</div>;
    
    return (
      <div className="metric">
        <span>{label}:</span>
        <div className="meter">
          <div 
            className="meter-fill" 
            style={{
              width: `${value * 100}%`,
              backgroundColor: value < 0.5 ? '#ff4d4d' : value < 0.7 ? '#ffdd57' : '#00c851'
            }}
          ></div>
        </div>
        <span>{(value * 100).toFixed(1)}%</span>
      </div>
    );
  };

  // Función para cambiar el tema
  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`app-container ${darkMode ? 'dark-theme' : ''}`}>
      <div className="sidebar">
        <div className="sidebar-section">
          <h3>Modo de Chat</h3>
          <button 
            onClick={() => {
              setShowComparison(false);
              setShowDocumentManager(false);
            }}
            className={`mode-button ${!showComparison && !showDocumentManager ? 'active' : ''}`}
          >
            Chat RAG
          </button>
          <button 
            onClick={() => {
              setShowComparison(true);
              setShowDocumentManager(false);
            }}
            className={`mode-button ${showComparison ? 'active' : ''}`}
          >
            Comparar Modelos
          </button>
        </div>

        <div className="sidebar-section">
          <h3>Colección Activa</h3>
          <div className="collection-selector">
            <select 
              value={currentCollection}
              onChange={(e) => setCurrentCollection(e.target.value)}
            >
              <option value="">Seleccionar colección</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Gestión</h3>
          <button 
            onClick={() => {
              setShowComparison(false);
              setShowDocumentManager(!showDocumentManager);
            }}
            className={`mode-button ${showDocumentManager ? 'active' : ''}`}
          >
            Gestión de Documentos
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="chat-container">
          <header className="chat-header">
            <h1>EstrategIA-v1</h1>
            <div className="header-controls">
              <button 
                onClick={toggleTheme} 
                className="theme-toggle"
                title={darkMode ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </header>
          
          {showDocumentManager ? (
            <DocumentManager />
          ) : !showComparison ? (
            // Vista normal del chat
            <>
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <p>Ask a question to start a chat</p>
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
            </>
          ) : (
            // Vista de comparación de modelos
            <div className="comparison-container">
              <div className="model-selection">
                <h3>Selecciona los modelos a comparar:</h3>
                <div className="model-checkboxes">
                  {isLoadingModels ? (
                    <p>Cargando modelos...</p>
                  ) : (
                    models.map(model => (
                      <label key={model} className="model-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model)}
                          onChange={() => handleModelSelection(model)}
                        />
                        {model}
                      </label>
                    ))
                  )}
                </div>
              </div>
              
              <div className="comparison-input">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe una pregunta para comparar modelos..."
                  disabled={isComparing}
                />
                <button 
                  onClick={compareModels} 
                  disabled={!input.trim() || isComparing || selectedModels.length === 0}
                >
                  {isComparing ? "Consultando..." : "Obtener métricas"}
                </button>
              </div>
              
              {comparisonResults && !isComparing && (
                <div className="results-grid">
                  {Object.keys(comparisonResults).map(model => (
                    <div key={model} className="model-result-card">
                      <h3 className="model-name">{model}</h3>
                      
                      {metrics && metrics[model] && !metrics[model].error && (
                        <div className="metrics-container">
                          <h4>Métricas de Evaluación:</h4>
                          {renderMetricBar(metrics[model].faithfulness, "Fidelidad")}
                          {renderMetricBar(metrics[model].answer_relevancy, "Relevancia")}
                          {renderMetricBar(metrics[model].context_relevancy, "Precisión")}
                          {renderMetricBar(metrics[model].overall_score, "Puntuación global")}
                        </div>
                      )}
                      
                      <div className="model-answer">
                        <h4>Respuesta:</h4>
                        <div className="answer-text">
                          {comparisonResults[model]}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {isComparing && (
                <div className="comparison-loading">
                  <div className="loading-spinner"></div>
                  <p>Comparando modelos, por favor espera...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
