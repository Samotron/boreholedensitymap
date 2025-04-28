import React, { useState } from 'react';
import FileUpload from './FileUpload';

interface SidebarProps {
  onGeoJSONUploaded: (data: any) => void;
}

export default function Sidebar({ onGeoJSONUploaded }: SidebarProps) {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileUploaded = (geojsonData: any) => {
    // Pass the uploaded GeoJSON data to the parent component
    onGeoJSONUploaded(geojsonData);
    
    // If the GeoJSON has a name property, use it, otherwise use a generic name
    const name = geojsonData.name || "Custom Data";
    setUploadedFileName(name);
  };

  return (
    <div className="absolute left-0 top-0 w-80 h-screen bg-white shadow-lg z-10 p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">UK Borehole Density Map</h1>
      
      <section className="mb-6">
        <FileUpload onFileUploaded={handleFileUploaded} />
        {uploadedFileName && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-xs text-blue-700 font-medium">
              Successfully loaded: {uploadedFileName}
            </p>
          </div>
        )}
      </section>
      
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">About</h2>
        <p className="text-sm text-gray-700 mb-3">
          This application visualizes the density of boreholes across the United Kingdom using hexagonal binning. 
          The visualization helps identify areas with high concentrations of geological sampling and research activity.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">How It Works</h2>
        <p className="text-sm text-gray-700 mb-3">
          The map uses hierarchical hexagonal binning (H3) to aggregate borehole locations at different zoom levels. 
          Colors indicate the density of boreholes in each area:
        </p>
        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
          <div className="h-4 w-full mb-2 rounded-sm bg-gradient-to-r from-[#41B6C4] via-[#C7E9B4] to-[#D7191C]"></div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Low Density</span>
            <span>Medium</span>
            <span>High Density</span>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">Data Source</h2>
        <p className="text-sm text-gray-700 mb-3">
          The data is sourced from the British Geological Survey (BGS) Borehole Index, 
          which maintains records of boreholes, shafts, and wells across Great Britain.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">GitHub Repository</h2>
        <a 
          href="https://github.com/samotron/boreholedensitymap" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">View on GitHub</span>
        </a>
      </section>

      <footer className="text-xs border-t pt-4 border-gray-200 text-gray-500">
        <h2 className="font-semibold mb-1">Attributions</h2>
        <p className="mb-2">
          Contains British Geological Survey materials © UKRI [2025]
        </p>
        <p className="mb-2">
          Basemap © OpenStreetMap contributors
        </p>
        <p>
          Powered by DeckGL and H3 hexagonal binning
        </p>
      </footer>
    </div>
  );
}