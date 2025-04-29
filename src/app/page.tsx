'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';

// Import Map component dynamically to avoid SSR issues with DeckGL
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-gray-700">Loading map component...</p>
      </div>
    </div>
  )
});

interface ProcessedData {
  [resolution: number]: Array<{
    hexId: string;
    count: number;
  }>;
}

export default function Home() {
  const [data, setData] = useState<Array<{ hexId: string; count: number }>>([]);
  const [resolution, setResolution] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [uploadedGeoJSON, setUploadedGeoJSON] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if screen is mobile on initial load and listen for resize
  useEffect(() => {
    const checkIfMobile = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      // Auto-collapse sidebar on mobile
      if (isMobileDevice) {
        setIsSidebarCollapsed(true);
      }
    };

    // Set initial value
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const loadResolutionData = useCallback(async (resolution: number) => {
    try {
      const res = await fetch(`/boreholedensitymap/data/h3_scale_${resolution}.json`);
      if (!res.ok) {
        throw new Error('Failed to load data');
      }
      const loadedData = await res.json();
      if (!Array.isArray(loadedData)) {
        throw new Error('Invalid data format');
      }
      setData(loadedData.map(item => ({
        hexId: item.cell.toString(),
        count: item.count
      })));
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.message);
    }
  }, []);

  const handleResolutionChange = (newResolution: number) => {
    setResolution(newResolution);
    loadResolutionData(newResolution);
  };

  const handleGeoJSONUploaded = (geojsonData: any) => {
    setUploadedGeoJSON(geojsonData);
    
    // If we're on mobile and upload data, collapse the sidebar to show the map
    if (isMobile) {
      setIsSidebarCollapsed(true);
    }
  };

  useEffect(() => {
    loadResolutionData(resolution);
  }, [loadResolutionData, resolution]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center flex-col gap-4 bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <p className="text-red-500 text-lg font-medium mb-2">Error: {error}</p>
          <p className="text-gray-600">Make sure to run the preprocessing script first</p>
        </div>
      </div>
    );
  }

  // Calculate sidebar width based on collapsed state and mobile status
  const sidebarWidth = isSidebarCollapsed ? (isMobile ? 10 : 12) : (isMobile ? 0 : 320);

  return (
    <div className="w-full h-screen overflow-hidden relative">
      <Sidebar 
        onGeoJSONUploaded={handleGeoJSONUploaded} 
        isCollapsed={isSidebarCollapsed} 
        onToggleCollapse={toggleSidebar}
        isMobile={isMobile}
      />
      
      <div 
        className={`h-screen transition-all duration-300 ease-in-out ${
          isSidebarCollapsed 
            ? `ml-${isMobile ? '10' : '12'} w-[calc(100%-${isMobile ? '2.5' : '3'}rem)]` 
            : isMobile ? 'ml-0 w-full' : 'md:ml-80 sm:ml-0 md:w-[calc(100%-20rem)] sm:w-full'
        }`}
      >
        <Map 
          uploadedGeoJSON={uploadedGeoJSON} 
          sidebarWidth={sidebarWidth}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
