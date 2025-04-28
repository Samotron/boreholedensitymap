import React, { useState, useRef } from 'react';

interface FileUploadProps {
  onFileUploaded: (geojsonData: any) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (file.type !== 'application/geo+json' && !file.name.endsWith('.geojson')) {
      setError('Please upload a valid GeoJSON file');
      return;
    }

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (typeof event.target?.result === 'string') {
          const geojsonData = JSON.parse(event.target.result);
          
          // Basic validation of GeoJSON data
          if (!geojsonData.type || !['FeatureCollection', 'Feature'].includes(geojsonData.type)) {
            throw new Error('Invalid GeoJSON format');
          }
          
          onFileUploaded(geojsonData);
        }
      } catch (err) {
        setError('Invalid GeoJSON file format');
        console.error('Error parsing GeoJSON:', err);
      }
    };
    
    reader.onerror = () => {
      setError('Error reading file');
    };
    
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2 text-gray-800">Upload GeoJSON</h2>
      
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,application/geo+json"
          className="hidden"
          onChange={handleFileInputChange}
        />
        
        <div className="p-2">
          <svg 
            className="w-8 h-8 mx-auto mb-2 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>
          
          {fileName ? (
            <p className="text-sm text-gray-700">
              <span className="font-medium text-blue-600">{fileName}</span> uploaded
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Drag and drop a GeoJSON file here, or click to browse
            </p>
          )}
        </div>
      </div>
      
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
      
      <p className="mt-2 text-xs text-gray-500">
        Upload GeoJSON files to visualize your own data on the map
      </p>
    </div>
  );
};

export default FileUpload;