// Componente DocumentManager.tsx
import { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

function DocumentManager() {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [directory, setDirectory] = useState('');
  const [chunkSize, setChunkSize] = useState(1024);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  // Crear nueva colección
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    try {
      const response = await axios.post(`${API_URL}/api/collections`, {
        name: newCollectionName
      });
      
      setMessage(response.data.message);
      setNewCollectionName('');
    } catch (error) {
      console.error('Error al crear colección:', error);
      setMessage(`Error: ${error.response?.data?.detail || 'No se pudo crear la colección'}`);
    }
  };

  // Procesar documentos
  const handleProcessDocuments = async () => {
    if (!directory.trim()) return;
    
    setIsProcessing(true);
    setMessage('Procesando documentos...');
    
    try {
      const response = await axios.post(`${API_URL}/api/documents/process`, {
        directory: directory,
        chunk_size: chunkSize
      });
      
      setMessage(`Procesamiento iniciado: ${response.data.message}`);
    } catch (error) {
      console.error('Error al procesar documentos:', error);
      setMessage(`Error: ${error.response?.data?.detail || 'No se pudieron procesar los documentos'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="document-manager">
      <h2>Gestión de Documentos</h2>
      
      <div className="section">
        <h3>Procesar Documentos</h3>
        <div className="process-form">
          <div className="form-group">
            <label>Directorio de documentos:</label>
            <input
              type="text"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              placeholder="/ruta/a/documentos"
            />
          </div>
          
          <div className="form-group">
            <label>Tamaño de fragmento:</label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value))}
              min="256"
              max="4096"
            />
          </div>
          
          <div className="new-collection">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Nombre de nueva colección"
            />
            <button onClick={handleCreateCollection}>
              Crear Colección
            </button>
          </div>
          
          <button 
            onClick={handleProcessDocuments}
            disabled={isProcessing || !directory}
          >
            {isProcessing ? 'Procesando...' : 'Procesar Documentos'}
          </button>
        </div>
      </div>
      
      {message && (
        <div className="message">
          {message}
        </div>
      )}
    </div>
  );
}

export default DocumentManager;