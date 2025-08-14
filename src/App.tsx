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
  const [selectedChatModel, setSelectedChatModel] = useState('');
  const [showModelChangeConfirm, setShowModelChangeConfirm] = useState(false);
  const [showCollectionChangeConfirm, setShowCollectionChangeConfirm] = useState(false);
  const [pendingModel, setPendingModel] = useState('');
  const [pendingCollection, setPendingCollection] = useState('');
  // Agregar nuevo estado para juez
  const [judgeModel, setJudgeModel] = useState<string>('');
  const [includeRetrievalMetrics, setIncludeRetrievalMetrics] = useState(false);
  const [retrievalMetrics, setRetrievalMetrics] = useState(null);
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
          
          // Preseleccionar el modelo por defecto para chat y comparación
          if (response.data.default_model) {
            setSelectedModels([response.data.default_model]);
            setSelectedChatModel(response.data.default_model);
          } else if (response.data.models.length > 0) {
            setSelectedModels([response.data.models[0]]);
            setSelectedChatModel(response.data.models[0]);
          }
        } else {
          console.error('Formato de respuesta inválido:', response.data);
          setModels(["No se pudieron cargar los modelos"]);
        }
      } catch (error) {
        console.error('Error al cargar modelos:', error);
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
    
    // Validar que estén seleccionados modelo y colección
    if (!selectedChatModel) {
      alert("Por favor selecciona un modelo antes de enviar el mensaje");
      return;
    }
    
    if (!currentCollection) {
      alert("Por favor selecciona una colección antes de enviar el mensaje");
      return;
    }
    
    // Añadir mensaje del usuario
    const userMessage = input;
    setMessages([...messages, { text: userMessage, isUser: true }]);
    setInput('');
    setIsLoading(true);

    try {
      console.log("Enviando consulta...", {
        message: userMessage,
        model: selectedChatModel,
        collection: currentCollection
      });
      
      // Enviar solicitud al backend FastAPI con el modelo y colección seleccionados
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        model: selectedChatModel,
        collection: currentCollection,
        chunk_size: 1024  // O hacer configurable desde UI
      }, {
        timeout: 120000
      });
      
      console.log("Respuesta recibida:", response.data);
      
      // Añadir respuesta de la IA
      setMessages(prev => [...prev, { text: response.data.response, isUser: false }]);
    } catch (error: any) {
      console.error('Error completo:', error);
      console.error('Error response:', error.response);
      console.error('Error request:', error.request);
      console.error('Error message:', error.message);
      
      let errorMessage = "Ha ocurrido un error inesperado.";
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = "La consulta tardó demasiado tiempo. Intenta con una pregunta más simple.";
      } else if (error.response) {
        errorMessage = `Error del servidor: ${error.response.status} - ${error.response.data?.detail || 'Error desconocido'}`;
      } else if (error.request) {
        errorMessage = "No se pudo conectar con el servidor. Verifica que el backend esté funcionando.";
      } else {
        errorMessage = `Error de configuración: ${error.message}`;
      }
      
      setMessages(prev => [...prev, { 
        text: errorMessage, 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Agregar la función de comparación aquí
  const compareModels = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log("📊 Iniciando comparación de modelos...");
      console.log("🔍 Incluir métricas de retrieval:", includeRetrievalMetrics);
      
      const response = await axios.post(`${API_URL}/compare-models`, {
        message: input,
        models: selectedModels,
        collection: currentCollection,
        judge_model: judgeModel,
        include_retrieval_metrics: includeRetrievalMetrics  // ✅ NUEVO
      });
      
      console.log("✅ Respuesta recibida:", response.data);
      
      setComparisonResults(response.data.results);
      setMetrics(response.data.metrics);
      setRetrievalMetrics(response.data.retrieval_metrics);  // ✅ NUEVO
      
      // ✅ Log específico para métricas de retrieval
      if (response.data.retrieval_metrics) {
        console.log("📊 Métricas de retrieval recibidas:", response.data.retrieval_metrics);
      }
      
    } catch (error) {
      console.error('Error comparing models:', error);
      setError('Error al comparar modelos. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
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

  const renderMetricBar = (value: number | null | undefined, label: string) => {
    // Si no hay valor o RAGAS no está disponible, no mostrar la métrica
    if (value === null || value === undefined) {
      return null; // No renderizar nada
    }
    
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

  // Función para manejar cambio de modelo en chat
  const handleChatModelChange = (newModel: string) => {
    if (messages.length > 0) {
      setPendingModel(newModel);
      setShowModelChangeConfirm(true);
    } else {
      setSelectedChatModel(newModel);
    }
  };

  // Función para manejar cambio de colección
  const handleCollectionChange = (newCollection: string) => {
    if (messages.length > 0) {
      setPendingCollection(newCollection);
      setShowCollectionChangeConfirm(true);
    } else {
      setCurrentCollection(newCollection);
    }
  };

  const confirmModelChange = () => {
    setSelectedChatModel(pendingModel);
    setMessages([]);
    setShowModelChangeConfirm(false);
    setPendingModel('');
  };

  const confirmCollectionChange = () => {
    setCurrentCollection(pendingCollection);
    setMessages([]);
    setShowCollectionChangeConfirm(false);
    setPendingCollection('');
  };

  const cancelModelChange = () => {
    setShowModelChangeConfirm(false);
    setPendingModel('');
  };

  const cancelCollectionChange = () => {
    setShowCollectionChangeConfirm(false);
    setPendingCollection('');
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
          <h3>Modelo de Chat</h3>
          <div className="model-selector">
            <select
              value={selectedChatModel}
              onChange={(e) => handleChatModelChange(e.target.value)}
              disabled={isLoadingModels}
            >
              <option value="" disabled>
                {isLoadingModels ? 'Cargando modelos...' : 'Seleccionar modelo'}
              </option>
              {models.map(model => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Colección Activa</h3>
          <div className="collection-selector">
            <select 
              value={currentCollection}
              onChange={(e) => handleCollectionChange(e.target.value)}
            >
              <option value="" disabled>Seleccionar colección</option>
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
                  {isLoading ? 'Enviando...' : 'Enviar'}
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
                
                {/* Nuevo: Selección de modelo juez */}
                <div className="judge-selection">
                  <h4>Selecciona el modelo juez para evaluación:</h4>
                  <select 
                    value={judgeModel} 
                    onChange={(e) => setJudgeModel(e.target.value)}
                    className="judge-selector"
                  >
                    <option value="">Seleccionar modelo juez...</option>
                    {models
                      .filter(model => !selectedModels.includes(model))
                      .map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))
                    }
                  </select>
                  {judgeModel && (
                    <p className="judge-info">
                      🏅 Juez seleccionado: <strong>{judgeModel}</strong>
                    </p>
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
                  disabled={
                    !input.trim() || 
                    isComparing || 
                    selectedModels.length === 0 || 
                    !currentCollection ||
                    !judgeModel  // ← Nueva validación
                  }
                >
                  {isComparing ? "Evaluando..." : "Obtener evaluación académica"}
                </button>
              </div>
              
              {showComparison && comparisonResults && (
                <div className="comparison-panel">
                  <h3>📊 Evaluación Académica con LlamaIndex</h3>
                  
                  {/* Mostrar información del juez */}
                  <div className="judge-info-panel">
                    <h4>🏅 Modelo Juez: {judgeModel}</h4>
                    <p>El modelo juez evalúa las respuestas usando métricas académicas estándar</p>
                  </div>
                  
                  {/* Mostrar resultados por modelo */}
                  {Object.entries(comparisonResults).map(([model, response]) => (
                    <div key={model} className="model-comparison">
                      <h3>🤖 Modelo: {model}</h3>
                      <div className="model-response">{response}</div>
                      
                      {/* Métricas académicas evaluadas por el juez */}
                      {metrics && metrics[model] && !metrics[model].error && (
                        <div className="academic-metrics">
                          <h4>📊 Evaluación del Juez ({judgeModel})</h4>
                          <div className="metrics-grid">
                            {Object.entries(metrics[model])
                              .filter(([key]) => key !== 'overall_score')
                              .map(([metric, data]) => (
                                <div key={metric} className="metric-item">
                                  <span className="metric-name">{metric}:</span>
                                  <span className="metric-score">
                                    {data.score ? data.score.toFixed(2) : 'N/A'}
                                    {data.passing ? ' ✅' : ' ❌'}
                                  </span>
                                  {data.feedback && (
                                    <div className="metric-feedback">{data.feedback}</div>
                                  )}
                                </div>
                              ))}
                            
                            {/* Puntuación general */}
                            {metrics[model].overall_score !== undefined && (
                              <div className="overall-score">
                                <strong>Puntuación General: {metrics[model].overall_score.toFixed(2)}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {metrics && metrics[model] && metrics[model].error && (
                        <div className="metric-error">
                          ❌ Error en evaluación: {metrics[model].error}
                        </div>
                      )}
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

      {/* Modal de confirmación para cambio de modelo */}
      {showModelChangeConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Cambiar modelo de chat</h3>
            <p>Al hacer este cambio se borrará la conversación actual. ¿Deseas continuar?</p>
            <div className="modal-buttons">
              <button onClick={cancelModelChange} className="cancel-button">Cancelar</button>
              <button onClick={confirmModelChange} className="confirm-button">Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para cambio de colección */}
      {showCollectionChangeConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Cambiar colección activa</h3>
            <p>Al hacer este cambio se borrará la conversación actual. ¿Deseas continuar?</p>
            <div className="modal-buttons">
              <button onClick={cancelCollectionChange} className="cancel-button">Cancelar</button>
              <button onClick={confirmCollectionChange} className="confirm-button">Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Panel de métricas de retrieval */}
      {retrievalMetrics && !retrievalMetrics.error && (
        <div className="retrieval-metrics-panel">
          <h3>🔍 Calidad del Retrieval para tu Pregunta</h3>
          
          <div className="query-display">
            <strong>Tu pregunta:</strong> <span className="user-query">{retrievalMetrics.query}</span>
          </div>
          
          <div className="retrieval-info">
            <div className="info-item">
              <span>📄 Modelo de Embeddings:</span>
              <span>{retrievalMetrics.metadata?.embedding_model || 'FastEmbed'}</span>
            </div>
            <div className="info-item">
              <span>🗄️ Base de Datos:</span>
              <span>{retrievalMetrics.metadata?.vector_store || 'Qdrant'}</span>
            </div>
            <div className="info-item">
              <span>📄 Docs Recuperados:</span>
              <span>{retrievalMetrics.retrieved_count}</span>
            </div>
          </div>
          
          <div className="metrics-grid">
            <div className={`metric-card ${retrievalMetrics.interpretation?.hit_rate_status}`}>
              <div className="metric-name">Hit Rate</div>
              <div className="metric-value">{retrievalMetrics.hit_rate.toFixed(3)}</div>
              <div className="metric-description">
                {retrievalMetrics.hit_rate === 1.0 
                  ? "✅ Se encontraron documentos relevantes" 
                  : "⚠️ No se encontraron documentos suficientemente relevantes"}
              </div>
            </div>
            
            <div className={`metric-card ${retrievalMetrics.interpretation?.mrr_quality}`}>
              <div className="metric-name">MRR (Mean Reciprocal Rank)</div>
              <div className="metric-value">{retrievalMetrics.mrr.toFixed(3)}</div>
              <div className="metric-description">
                {retrievalMetrics.mrr > 0.8 ? "🎯 Excelente ranking" :
                 retrievalMetrics.mrr > 0.5 ? "👍 Buen ranking" : "⚠️ Ranking mejorable"}
              </div>
            </div>
          </div>
          
          <div className="retrieval-explanation">
            <h4>📖 Interpretación de Métricas</h4>
            <ul>
              <li><strong>Hit Rate:</strong> ¿Se encontraron documentos relevantes en los resultados?</li>
              <li><strong>MRR:</strong> ¿En qué posición aparece el primer documento relevante?</li>
            </ul>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Error en métricas de retrieval */}
      {retrievalMetrics?.error && (
        <div className="retrieval-error">
          ❌ Error evaluando métricas de retrieval: {retrievalMetrics.error}
        </div>
      )}
    </div>
  );
}

export default App;
