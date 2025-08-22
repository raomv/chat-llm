import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ChatMessage from './components/ChatMessage';
import DocumentManager from './components/DocumentManager';
import './App.css';

// URL del backend - Ajusta según tu configuración
const API_URL = 'http://localhost:8000';

interface Message {
  text: string;
  isUser: boolean;
}

interface RetrievalMetrics {
  query: string;
  retrieved_count: number;
  retrieval_time_ms: number;
  score_at_1?: number;
  mean_score?: number;
  var_score?: number;
  margin_at_1?: number;
  accept_rate_at_threshold?: number;
  threshold_used?: number;
  qd_mean?: number;
  qd_max?: number;
  docdoc_coherence?: number;
  diversity?: number;
  unique_sources?: number;
  metadata?: {
    embedding_model: string;
    vector_store: string;
    evaluation_timestamp: number;
    similarity_top_k: number;
  };
  error?: string;
}

// En la interface ModelMetrics:
interface ModelMetrics {
  faithfulness?: number;
  relevancy?: number;
  correctness?: number;
  semantic_similarity?: number;
  guideline?: number;
  overall_score?: number;
  ragas_faithfulness?: number;     // ✅ MANTENER
  ragas_context_recall?: number;   // ✅ MANTENER
  // ✅ MÉTRICAS RAGAS DESACTIVADAS:
  // ragas_context_precision?: number;  
  // ragas_answer_relevancy?: number;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [darkMode, setDarkMode] = useState(false);
  const [collections, setCollections] = useState<string[]>([]);
  const [currentCollection, setCurrentCollection] = useState('');
  const [selectedChatModel, setSelectedChatModel] = useState('');
  const [error, setError] = useState('');
  const [showModelChangeConfirm, setShowModelChangeConfirm] = useState(false);
  const [showCollectionChangeConfirm, setShowCollectionChangeConfirm] = useState(false);
  const [pendingModel, setPendingModel] = useState('');
  const [pendingCollection, setPendingCollection] = useState('');
  const [judgeModel, setJudgeModel] = useState<string>('');
  const [includeRetrievalMetrics, setIncludeRetrievalMetrics] = useState(false);
  const [includeRagasMetrics, setIncludeRagasMetrics] = useState(false);  // NUEVO
  const [retrievalMetrics, setRetrievalMetrics] = useState<RetrievalMetrics | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar la preferencia de tema al iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      setDarkMode(savedTheme === 'true');
    } else {
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
        setError('Error cargando modelos del servidor');
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
        setError('Error cargando colecciones del servidor');
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
    
    if (!selectedChatModel) {
      setError("Por favor selecciona un modelo antes de enviar el mensaje");
      return;
    }
    
    if (!currentCollection) {
      setError("Por favor selecciona una colección antes de enviar el mensaje");
      return;
    }
    
    const userMessage = input;
    setMessages([...messages, { text: userMessage, isUser: true }]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      console.log("Enviando consulta...", {
        message: userMessage,
        model: selectedChatModel,
        collection: currentCollection
      });
      
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMessage,
        model: selectedChatModel,
        collection: currentCollection,
        chunk_size: 1024
      }, {
        timeout: 120000
      });
      
      console.log("Respuesta recibida:", response.data);
      
      setMessages(prev => [...prev, { text: response.data.response, isUser: false }]);
    } catch (error: any) {
      console.error('Error completo:', error);
      
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
      
      setError(errorMessage);
      setMessages(prev => [...prev, { 
        text: errorMessage, 
        isUser: false 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const compareModels = async () => {
    if (!input.trim()) {
      setError("Por favor escribe una pregunta para comparar");
      return;
    }
    
    if (!currentCollection) {
      setError("Por favor selecciona una colección antes de comparar modelos");
      return;
    }
    
    if (selectedModels.length === 0) {
      setError("Por favor selecciona al menos un modelo para comparar");
      return;
    }
    
    if (!judgeModel) {
      setError("Por favor selecciona un modelo juez para la evaluación");
      return;
    }
    
    // Asegurar que se muestran los estados correctos
    setShowComparison(true);
    setIsComparing(true);
    setError('');
    setComparisonResults(null);
    setMetrics(null);
    setRetrievalMetrics(null);
    
    console.log("📊 Iniciando comparación de modelos...");
    console.log("🔍 Incluir métricas de retrieval:", includeRetrievalMetrics);
    
    try {
      const response = await axios.post(`${API_URL}/compare-models`, {
        message: input,
        models: selectedModels,
        collection: currentCollection,
        judge_model: judgeModel,
        include_retrieval_metrics: includeRetrievalMetrics,
        include_ragas_metrics: includeRagasMetrics,  // NUEVO PARÁMETRO
      });
      
      console.log("✅ Respuesta recibida:", response.data);
      
      setComparisonResults(response.data.results);
      setMetrics(response.data.metrics);
      setRetrievalMetrics(response.data.retrieval_metrics);
      
      if (response.data.retrieval_metrics) {
        console.log("📊 Métricas de retrieval recibidas:", response.data.retrieval_metrics);
      }
      
    } catch (error: any) {
      console.error('Error comparing models:', error);
      const errorMsg = error.response?.data?.detail || 'Error al comparar modelos. Por favor, inténtalo de nuevo.';
      setError(errorMsg);
    } finally {
      setIsComparing(false);
    }
  };

  const handleModelSelection = (model: string) => {
    setSelectedModels(prev => {
      if (prev.includes(model)) {
        return prev.filter(m => m !== model);
      }
      return [...prev, model];
    });
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleChatModelChange = (newModel: string) => {
    if (messages.length > 0) {
      setPendingModel(newModel);
      setShowModelChangeConfirm(true);
    } else {
      setSelectedChatModel(newModel);
    }
  };

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
    setError('');
    setShowModelChangeConfirm(false);
    setPendingModel('');
  };

  const confirmCollectionChange = () => {
    setCurrentCollection(pendingCollection);
    setMessages([]);
    setError('');
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
              setError('');
            }}
            className={`mode-button ${!showComparison && !showDocumentManager ? 'active' : ''}`}
          >
            Chat RAG
          </button>
          <button 
            onClick={() => {
              setShowComparison(true);
              setShowDocumentManager(false);
              setError('');
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
              setError('');
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
          
          {error && (
            <div className="error-message">
              ❌ {error}
              <button onClick={() => setError('')} className="error-close">✕</button>
            </div>
          )}
          
          {showDocumentManager ? (
            <DocumentManager />
          ) : !showComparison ? (
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

                <div className="model-option retrieval-option">
                  <label className="retrieval-label">
                    <input
                      type="checkbox"
                      checked={includeRetrievalMetrics}
                      onChange={(e) => setIncludeRetrievalMetrics(e.target.checked)}
                      className="retrieval-checkbox"
                    />
                    📊 Evaluar calidad del retrieval para esta pregunta
                  </label>
                  <div className="option-description">
                    Evalúa Hit Rate y MRR del sistema de búsqueda vectorial (FastEmbed + Qdrant)
                  </div>
                </div>

                <div className="model-option retrieval-option">
                  <label className="retrieval-label">
                    <input
                      type="checkbox"
                      checked={includeRagasMetrics}
                      onChange={(e) => setIncludeRagasMetrics(e.target.checked)}
                      className="retrieval-checkbox"
                    />
                    🎯 Evaluar con métricas RAGAS estándar
                  </label>
                  <div className="option-description">
                    Métricas académicas estándar: Context Precision, Context Recall, Faithfulness y Answer Relevancy
                  </div>
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
                    !judgeModel
                  }
                >
                  {isComparing ? "Evaluando..." : "Obtener evaluación académica"}
                </button>
              </div>
              
              {isComparing && (
                <div className="comparison-loading">
                  <div className="loading-spinner"></div>
                  <p>🔍 Ejecutando evaluación académica...</p>
                  <p className="loading-details">
                    Esto puede tomar varios minutos. Evaluando {selectedModels.length} modelo(s) 
                    con {includeRetrievalMetrics ? '8 métricas de retrieval + ' : ''}
                    {includeRagasMetrics ? '4 métricas RAGAS + ' : ''}
                    5 métricas base
                  </p>
                </div>
              )}
              
              {!isComparing && comparisonResults && (
                <div className="comparison-panel">
                  <h3>📊 Evaluación Académica con LlamaIndex</h3>
                  
                  <div className="judge-info-panel">
                    <h4>🏅 Modelo Juez: {judgeModel}</h4>
                    <p>El modelo juez evalúa las respuestas usando métricas académicas estándar</p>
                  </div>
                  
                  {Object.entries(comparisonResults).map(([model, response]) => (
                    <div key={model} className="model-comparison">
                      <h3>🤖 Modelo: {model}</h3>
                      <div className="model-response">{response as string}</div>
                      
                      {metrics && metrics[model] && !metrics[model].error && (
                        <div className="academic-metrics">
                          <h4>📊 Evaluación del Juez ({judgeModel})</h4>
                          <div className="metrics-grid">
                            {/* ✅ SOLO MÉTRICAS NATIVAS DE LLAMAINDEX (SIN RAGAS) */}
                            {Object.entries(metrics[model])
                              .filter(([key]) => 
                                key !== 'overall_score' && 
                                key !== 'error' && 
                                !key.startsWith('ragas_')  // ✅ EXCLUIR métricas RAGAS
                              )
                              .map(([metric, data]: [string, any]) => (
                                <div key={metric} className="metric-item">
                                  {/* ✅ COLUMNA IZQUIERDA: Nombre y puntuación */}
                                  <div className="metric-left">
                                    <div className="metric-name">
                                      {metric.replace('_', ' ')}
                                    </div>
                                    <div className="metric-score">
                                      {typeof data === 'object' && data !== null ? (
                                        <>
                                          <span>{data.score?.toFixed(3) || 'N/A'}</span>
                                          <span style={{marginLeft: '8px'}}>
                                            {data.score !== undefined && (
                                              data.score >= 0.8 ? '🟢' : 
                                              data.score >= 0.6 ? '🟡' : 
                                              data.score >= 0.4 ? '🟠' : '🔴'
                                            )}
                                          </span>
                                        </>
                                      ) : typeof data === 'number' ? (
                                        <>
                                          <span>{data.toFixed(3)}</span>
                                          <span style={{marginLeft: '8px'}}>
                                            {data >= 0.8 ? '🟢' : data >= 0.6 ? '🟡' : data >= 0.4 ? '🟠' : '🔴'}
                                          </span>
                                        </>
                                      ) : (
                                        <span>N/A</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* ✅ COLUMNA DERECHA: Feedback completo siempre visible */}
                                  <div className="metric-content">
                                    {typeof data === 'object' && data !== null && data.feedback && (
                                      <div className="metric-feedback">
                                        <strong>💬 Feedback del Juez:</strong><br />
                                        <div className="feedback-text">
                                          {data.feedback}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            
                            {/* ✅ OVERALL SCORE - Solo métricas nativas */}
                            {metrics[model].overall_score !== undefined && (
                              <div className="overall-score">
                                <strong>🎯 Puntuación General: {metrics[model].overall_score.toFixed(3)}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ✅ SECCIÓN SEPARADA SOLO PARA MÉTRICAS RAGAS */}
                      {Object.keys(metrics[model] || {}).some(key => key.startsWith('ragas_')) && (
                        <div className="ragas-metrics">
                          <h4>🎯 Métricas RAGAS Estándar</h4>
                          <div className="metrics-grid">
                            {Object.entries(metrics[model])
                              .filter(([key]) => key.startsWith('ragas_'))  // ✅ SOLO métricas RAGAS
                              .map(([metric, value]: [string, any]) => {
                                // Extraer nombre limpio de la métrica
                                const cleanName = metric.replace('ragas_', '').replace('_', ' ');
                                const score = typeof value === 'number' ? value : 0;
                                
                                return (
                                  <div key={metric} className="metric-item">
                                    <div className="metric-left">
                                      <div className="metric-name">{cleanName}</div>
                                      <div className="metric-score">
                                        <span>{score.toFixed(3)}</span>
                                        <span style={{marginLeft: '8px'}}>
                                          {score >= 0.8 ? '🟢' : score >= 0.6 ? '🟡' : score >= 0.4 ? '🟠' : '🔴'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="metric-content">
                                      <div className="metric-feedback">
                                        <strong>📋 Descripción:</strong><br />
                                        {metric === 'ragas_context_precision' && 
                                          'Proporción de documentos recuperados que son realmente útiles para responder la pregunta.'}
                                        {metric === 'ragas_context_recall' && 
                                          'Qué tan completa es la información recuperada respecto a la respuesta ideal.'}
                                        {metric === 'ragas_faithfulness' && 
                                          'Qué tan fiel es la respuesta a la información proporcionada en el contexto.'}
                                        {metric === 'ragas_answer_relevancy' && 
                                          'Qué tan relevante es la respuesta generada para la pregunta formulada.'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
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
                  
                  {retrievalMetrics && !retrievalMetrics.error && (
                    <div className="retrieval-metrics-panel">
                      <h3>🔍 Métricas de Retrieval Label-Free</h3>
                      
                      <div className="query-display">
                        <strong>Tu pregunta:</strong> <span className="user-query">{retrievalMetrics.query}</span>
                      </div>
                      
                      {/* Métricas básicas */}
                      <div className="retrieval-info">
                        <div className="info-item">
                          <span>📄 Documentos:</span>
                          <span>{retrievalMetrics.retrieved_count}</span>
                        </div>
                        <div className="info-item">
                          <span>⏱️ Tiempo:</span>
                          <span>{retrievalMetrics.retrieval_time_ms}ms</span>
                        </div>
                        <div className="info-item">
                          <span>📚 Fuentes únicas:</span>
                          <span>{retrievalMetrics.unique_sources}</span>
                        </div>
                      </div>
                      
                      {/* Métricas de scores */}
                      <div className="metrics-grid">
                        <div className="metric-card">
                          <div className="metric-name">Score@1</div>
                          <div className="metric-value">{retrievalMetrics.score_at_1?.toFixed(4) || 'N/A'}</div>
                          <div className="metric-description">Score del mejor resultado</div>
                        </div>
                        
                        <div className="metric-card">
                          <div className="metric-name">Mean Score</div>
                          <div className="metric-value">{retrievalMetrics.mean_score?.toFixed(4) || 'N/A'}</div>
                          <div className="metric-description">Promedio de similarity scores</div>
                        </div>
                        
                        <div className="metric-card">
                          <div className="metric-name">Accept Rate</div>
                          <div className="metric-value">{((retrievalMetrics.accept_rate_at_threshold || 0) * 100).toFixed(1)}%</div>
                          <div className="metric-description">% docs &gt; {retrievalMetrics.threshold_used || 0.7}</div>
                        </div>
                      </div>
                      
                      {/* Métricas de embeddings (si disponibles) */}
                      {retrievalMetrics.qd_mean !== undefined && (
                        <div className="embedding-metrics">
                          <h4>🎯 Métricas de Embeddings</h4>
                          <div className="metrics-grid">
                            <div className="metric-card">
                              <div className="metric-name">Query-Doc Mean</div>
                              <div className="metric-value">{retrievalMetrics.qd_mean.toFixed(4)}</div>
                              <div className="metric-description">Alineación semántica promedio</div>
                            </div>
                            
                            <div className="metric-card">
                              <div className="metric-name">Doc-Doc Coherence</div>
                              <div className="metric-value">{retrievalMetrics.docdoc_coherence?.toFixed(4)}</div>
                              <div className="metric-description">Coherencia entre documentos</div>
                            </div>
                            
                            <div className="metric-card">
                              <div className="metric-name">Diversity</div>
                              <div className="metric-value">{retrievalMetrics.diversity?.toFixed(4)}</div>
                              <div className="metric-description">Diversidad del conjunto</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="retrieval-explanation">
                        <h4>📖 Interpretación</h4>
                        <ul>
                          <li><strong>Score@1:</strong> Calidad del mejor resultado (más alto = mejor match)</li>
                          <li><strong>Accept Rate:</strong> % de resultados con alta confianza</li>
                          <li><strong>Diversity:</strong> Variedad temática (0.2-0.8 es ideal)</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {retrievalMetrics?.error && (
                    <div className="retrieval-error">
                      ❌ Error evaluando métricas de retrieval: {retrievalMetrics.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
}

export default App;
