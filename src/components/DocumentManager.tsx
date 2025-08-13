// Componente DocumentManager.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

function DocumentManager() {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [directory, setDirectory] = useState('');
  const [chunkSize, setChunkSize] = useState(1024);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [collections, setCollections] = useState<string[]>([]);
  
  // Nuevos estados para upload
  const [uploadMode, setUploadMode] = useState<'directory' | 'upload'>('upload');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  // Cargar colecciones disponibles al montar el componente
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/collections`);
        setCollections(response.data.collections);
      } catch (error) {
        console.error('Error al cargar colecciones:', error);
      }
    };
    
    fetchCollections();
  }, []);

  // Crear nueva colección
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    try {
      const response = await axios.post(`${API_URL}/api/collections`, {
        name: newCollectionName
      });
      
      setMessage(response.data.message);
      setNewCollectionName('');
      
      // Recargar la lista de colecciones
      const collectionsResponse = await axios.get(`${API_URL}/api/collections`);
      setCollections(collectionsResponse.data.collections);
    } catch (error: any) {
      console.error('Error al crear colección:', error);
      setMessage(`Error: ${error.response?.data?.detail || 'No se pudo crear la colección'}`);
    }
  };

  // Procesar documentos desde directorio
  const handleProcessDocuments = async () => {
    if (!directory.trim() || !selectedCollection) return;
    
    setIsProcessing(true);
    setMessage('Procesando documentos...');
    
    try {
      const response = await axios.post(`${API_URL}/api/documents/process`, {
        directory: directory,
        chunk_size: chunkSize,
        collection: selectedCollection
      });
      
      setMessage(`Procesamiento iniciado: ${response.data.message}`);
    } catch (error: any) {
      console.error('Error al procesar documentos:', error);
      setMessage(`Error: ${error.response?.data?.detail || 'No se pudieron procesar los documentos'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Subir y procesar archivos
  const handleUploadDocuments = async () => {
    if (!selectedFiles || selectedFiles.length === 0 || !selectedCollection) return;
    
    setIsProcessing(true);
    setMessage('Subiendo archivos y procesando con docling...');
    
    try {
      const formData = new FormData();
      
      // Añadir archivos
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }
      
      // Añadir parámetros
      formData.append('collection', selectedCollection);
      formData.append('chunk_size', chunkSize.toString());
      
      const response = await axios.post(`${API_URL}/api/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 1800000 // 30 minutos (1800 * 1000 ms)
      });
      
      setMessage(`✅ ${response.data.message}`);
      setSelectedFiles(null);
      
      // Limpiar input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      console.error('Error al subir archivos:', error);
      let errorMessage = 'Error desconocido';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'El procesamiento tardó demasiado tiempo. Archivos muy grandes pueden tardar varios minutos.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      setMessage(`❌ Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="document-manager">
      <h2>Gestión de Documentos</h2>
      
      <div className="section">
        <h3>Modo de Procesamiento</h3>
        <div className="mode-selector">
          <label>
            <input
              type="radio"
              value="upload"
              checked={uploadMode === 'upload'}
              onChange={(e) => setUploadMode(e.target.value as 'directory' | 'upload')}
            />
            Subir Archivos
          </label>
          <label>
            <input
              type="radio"
              value="directory"
              checked={uploadMode === 'directory'}
              onChange={(e) => setUploadMode(e.target.value as 'directory' | 'upload')}
            />
            Usar Directorio
          </label>
        </div>
      </div>
      
      <div className="section">
        <h3>Procesar Documentos</h3>
        <div className="process-form">
          
          {uploadMode === 'upload' ? (
            <div className="form-group">
              <label>Seleccionar archivos:</label>
              <input
                id="file-input"
                type="file"
                multiple
                accept=".pdf,.txt,.docx,.md"
                onChange={(e) => setSelectedFiles(e.target.files)}
              />
              {selectedFiles && (
                <div className="selected-files">
                  <p>Archivos seleccionados: {selectedFiles.length}</p>
                  <ul>
                    {Array.from(selectedFiles).map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label>Directorio de documentos:</label>
              <input
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="/ruta/a/documentos"
              />
            </div>
          )}
          
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
          
          <div className="form-group">
            <label>Colección destino:</label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
            >
              <option value="" disabled>Seleccionar colección</option>
              {collections.map(collection => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
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
            onClick={uploadMode === 'upload' ? handleUploadDocuments : handleProcessDocuments}
            disabled={
              isProcessing || 
              !selectedCollection || 
              (uploadMode === 'upload' ? !selectedFiles || selectedFiles.length === 0 : !directory)
            }
          >
            {isProcessing ? 'Procesando...' : 
             uploadMode === 'upload' ? 'Subir y Procesar' : 'Procesar Documentos'}
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