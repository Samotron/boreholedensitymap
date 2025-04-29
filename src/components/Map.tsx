import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { MapViewState } from '@deck.gl/core';
import { GeoJsonLayer, BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { FeatureCollection, Geometry } from 'geojson';
import { cellToBoundary } from 'h3-js';
import * as wellknown from 'wellknown';

// Calculate offset for the initial view to account for sidebar
const calculateLongitudeOffset = (latitude: number, zoom: number, sidebarWidthPixels: number): number => {
  const pixelsPerLongitudeDegree = Math.cos(latitude * Math.PI / 180) * 111000 * Math.pow(2, zoom) / 256;
  return (sidebarWidthPixels / 2) / pixelsPerLongitudeDegree;
};

// Default sidebar width is now a parameter
const DEFAULT_SIDEBAR_WIDTH = 320;

const COUNT_COLOR_SCALE = [
  [0, [65, 182, 196, 180]],
  [0.25, [127, 205, 187, 180]],
  [0.5, [199, 233, 180, 180]],
  [0.75, [252, 174, 145, 180]],
  [1, [215, 25, 28, 180]]
];

const PERCENTAGE_COLOR_SCALE = [
  [0, [65, 182, 196, 180]],
  [0.25, [127, 205, 187, 180]],
  [0.5, [199, 233, 180, 180]],
  [0.75, [252, 174, 145, 180]],
  [1, [215, 25, 28, 180]]
];

const interpolateColor = (value: number, colorScale: Array<[number, number[]]>) => {
  for (let i = 1; i < colorScale.length; i++) {
    const [prevStop, prevColor] = colorScale[i - 1];
    const [nextStop, nextColor] = colorScale[i];
    if (value <= nextStop) {
      const fraction = (value - prevStop) / (nextStop - prevStop);
      return prevColor.map((channel, index) => 
        Math.round(channel * (1 - fraction) + nextColor[index] * fraction)
      );
    }
  }
  return colorScale[colorScale.length - 1][1];
};

const getResolutionForZoom = (zoom: number): number => {
  if (zoom <= 4) return 3;
  if (zoom <= 5) return 4;
  if (zoom <= 6.5) return 5;
  if (zoom <= 8) return 6;
  if (zoom <= 9.5) return 7;
  return 7;
};

const featureCache: Record<number, FeatureCollection<Geometry>> = {};

const getHexDataForResolution = async (resolution: number): Promise<FeatureCollection<Geometry>> => {
  if (featureCache[resolution]) {
    return featureCache[resolution];
  }

  const filePath = `/boreholedensitymap/data/h3_scale_${resolution}.json`;
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Failed to load data for resolution ${resolution}`);
  }

  const rawData = await response.json();
  
  const features = rawData.map(item => {
    let geometry;
    if (item.wkt) {
      try {
        geometry = wellknown.parse(item.wkt);
      } catch (e) {
        console.error('Failed to parse WKT:', e);
        return null;
      }
    } else {
      const boundary = cellToBoundary(item.cell);
      geometry = {
        type: 'Polygon' as const,
        coordinates: [
          [...boundary.map(([lat, lng]) => [lng, lat]), boundary[0]].map(([lng, lat]) => [lng, lat])
        ]
      };
    }

    return {
      type: 'Feature' as const,
      geometry,
      properties: { 
        count: item.count,
        AGS_count: item.AGS_count || 0,
        AGS_Percentage: item.count > 0 ? ((item.AGS_count || 0) / item.count) * 100 : 0
      }
    };
  }).filter(Boolean);

  const featureCollection: FeatureCollection<Geometry> = {
    type: 'FeatureCollection',
    features
  };

  featureCache[resolution] = featureCollection;
  return featureCollection;
};

const Tooltip = ({
  object,
  x,
  y
}: {
  object: any;
  x: number;
  y: number;
}) => {
  if (!object) return null;

  return (
    <div style={{
      position: 'absolute',
      zIndex: 1,
      pointerEvents: 'none',
      left: x,
      top: y,
      backgroundColor: 'white',
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      <div>Total Boreholes: {object.properties.count}</div>
      <div>AGS Boreholes: {object.properties.AGS_count}</div>
      <div>AGS Percentage: {object.properties.AGS_Percentage.toFixed(1)}%</div>
    </div>
  );
};

const Legend = () => (
  <div className="fixed bottom-8 right-8 bg-white p-4 rounded-md shadow-md z-10 max-w-xs w-full sm:max-w-[240px]">
    <h3 className="m-0 mb-3 text-sm font-semibold">Borehole Density</h3>
    <div className="flex flex-col gap-2">
      <div className="w-full h-6 rounded bg-gradient-to-r from-[#41B6C4] via-[#C7E9B4] to-[#D7191C]" />
      <div className="flex justify-between w-full text-xs text-gray-600">
        <span>Low</span>
        <span>Medium</span>
        <span>High</span>
      </div>
    </div>
  </div>
);

const LayerControl = ({ 
  showBasemap, 
  showHexagons, 
  showUploadedGeoJSON,
  onToggleBasemap, 
  onToggleHexagons,
  onToggleUploadedGeoJSON,
  selectedMetric,
  onMetricChange,
  hasUploadedData
}: { 
  showBasemap: boolean; 
  showHexagons: boolean;
  showUploadedGeoJSON: boolean;
  onToggleBasemap: () => void; 
  onToggleHexagons: () => void;
  onToggleUploadedGeoJSON: () => void;
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
  hasUploadedData: boolean;
}) => (
  <div className="fixed top-5 right-5 bg-white p-3 rounded-md shadow-md z-10 max-w-xs">
    <div className="mb-3">
      <label className="text-sm mb-2 block">Color By:</label>
      <select 
        value={selectedMetric} 
        onChange={(e) => onMetricChange(e.target.value)}
        className="w-full p-1 text-sm rounded border"
      >
        <option value="count">Total Boreholes</option>
        <option value="AGS_count">AGS Boreholes</option>
        <option value="AGS_Percentage">AGS Percentage</option>
      </select>
    </div>
    <div className="mb-2">
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={showBasemap}
          onChange={onToggleBasemap}
        />
        Basemap
      </label>
    </div>
    <div className="mb-2">
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={showHexagons}
          onChange={onToggleHexagons}
        />
        Hexagon Layer
      </label>
    </div>
    {hasUploadedData && (
      <div>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={showUploadedGeoJSON}
            onChange={onToggleUploadedGeoJSON}
          />
          Uploaded GeoJSON
        </label>
      </div>
    )}
  </div>
);

// Helper function to calculate the scale bar length based on latitude and zoom
const calculateScaleBarDistance = (latitude: number, zoom: number): { width: number; distance: number; unit: string } => {
  // Earth's circumference at the equator in meters
  const earthCircumference = 40075016.686;
  
  // Adjust for latitude (the length of a degree of longitude decreases with increasing latitude)
  const metersPerPixel = (earthCircumference * Math.cos(latitude * Math.PI / 180)) / (256 * Math.pow(2, zoom));
  
  // Target scale bar width in pixels (adjust as needed)
  const targetWidth = 100;
  
  // Calculate distance represented by the target width
  let distance = targetWidth * metersPerPixel;
  let unit = 'm';
  
  // Round to a nice number and adjust unit if needed
  if (distance >= 1000) {
    distance = distance / 1000;
    unit = 'km';
  }
  
  // Round to a nice number (1, 2, 5, 10, 20, 50, 100, etc.)
  const magnitudes = [1, 2, 5];
  const scale = Math.pow(10, Math.floor(Math.log10(distance)));
  let bestDistance = magnitudes[0] * scale;
  
  for (const mag of magnitudes) {
    if (Math.abs(distance - mag * scale) < Math.abs(distance - bestDistance)) {
      bestDistance = mag * scale;
    }
  }
  
  // Calculate the width in pixels for this nice distance
  const width = bestDistance * (unit === 'km' ? 1000 : 1) / metersPerPixel;
  
  return {
    width,
    distance: bestDistance,
    unit
  };
};

// ScaleBar component
const ScaleBar = ({ 
  latitude, 
  zoom, 
  resolution,
  sidebarWidth
}: { 
  latitude: number; 
  zoom: number; 
  resolution: number;
  sidebarWidth: number 
}) => {
  // Calculate scale bar properties
  const scale = calculateScaleBarDistance(latitude, zoom);
  
  // Calculate the left position to avoid sidebar overlap
  const leftPosition = sidebarWidth + 20; // 20px padding from sidebar edge
  
  return (
    <div className="fixed bottom-8 bg-white p-3 rounded-md shadow-md z-10 max-w-xs transition-all duration-300 ease-in-out"
         style={{ left: `${leftPosition}px` }}>
      <div className="flex flex-col gap-2">
        {/* Scale bar visualization */}
        <div className="flex flex-col items-center">
          <div className="flex items-center">
            <div className="h-2 bg-gray-800" style={{ width: `${scale.width}px` }}></div>
          </div>
          <div className="text-xs text-gray-700 mt-1">
            {scale.distance} {scale.unit}
          </div>
        </div>
        
        {/* Info section */}
        <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-gray-200 mt-1">
            <div>H3 Resolution: {resolution}</div>
        </div>
      </div>
    </div>
  );
};

interface MapComponentProps {
  uploadedGeoJSON?: any;
  sidebarWidth?: number;
}

export default function MapComponent({ uploadedGeoJSON, sidebarWidth = DEFAULT_SIDEBAR_WIDTH }: MapComponentProps) {
  // Create initial view state with the appropriate offset based on sidebar width
  const initialViewState = useMemo(() => {
    const baseLatitude = 54.0;
    const baseZoom = 5;
    return {
      longitude: -2.5 + calculateLongitudeOffset(baseLatitude, baseZoom, sidebarWidth),
      latitude: baseLatitude,
      zoom: baseZoom,
      pitch: 0,
      bearing: 0
    };
  }, [sidebarWidth]);
  
  const [currentResolution, setCurrentResolution] = useState(getResolutionForZoom(initialViewState.zoom));
  const [hexData, setHexData] = useState<FeatureCollection<Geometry> | null>(null);
  const [viewState, setViewState] = useState(initialViewState);
  const [maxCount, setMaxCount] = useState(100);
  const [showBasemap, setShowBasemap] = useState(true);
  const [showHexagons, setShowHexagons] = useState(true);
  const [showUploadedGeoJSON, setShowUploadedGeoJSON] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{object: any; x: number; y: number} | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('count');

  // Update the view when the sidebar width changes
  useEffect(() => {
    setViewState(prev => ({
      ...prev,
      longitude: -2.5 + calculateLongitudeOffset(prev.latitude, prev.zoom, sidebarWidth)
    }));
  }, [sidebarWidth]);

  useEffect(() => {
    const fetchHexData = async () => {
      try {
        const data = await getHexDataForResolution(currentResolution);
        setHexData(data);
        if (data?.features) {
          const newMaxCount = Math.max(...data.features.map(f => f.properties[selectedMetric] || 0));
          setMaxCount(newMaxCount);
        }
      } catch (error) {
        console.error('Error fetching hex data:', error);
      }
    };

    fetchHexData();
  }, [currentResolution, selectedMetric]);

  useEffect(() => {
    if (hexData?.features) {
      const newMaxCount = Math.max(...hexData.features.map(f => f.properties[selectedMetric] || 0));
      setMaxCount(newMaxCount);
    }
  }, [hexData, selectedMetric]);

  const onViewStateChange = useCallback(({viewState}: {viewState: MapViewState}) => {
    setViewState(viewState);
    const newResolution = getResolutionForZoom(viewState.zoom);
    if (newResolution !== currentResolution) {
      setCurrentResolution(newResolution);
    }
  }, [currentResolution]);

  const basemapLayer = useMemo(() => new TileLayer({
    id: 'basemap',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    visible: showBasemap,
    renderSubLayers: props => {
      const {
        bbox: { west, south, east, north }
      } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north]
      });
    }
  }), [showBasemap]);

  const getHexagonColor = useCallback((feature: any) => {
    const value = feature.properties[selectedMetric];
    let normalizedValue;
    
    if (selectedMetric === 'AGS_Percentage') {
      normalizedValue = value / 100;
      return interpolateColor(normalizedValue, PERCENTAGE_COLOR_SCALE);
    } else {
      normalizedValue = Math.log(value + 1) / Math.log(maxCount + 1);
      return interpolateColor(normalizedValue, COUNT_COLOR_SCALE);
    }
  }, [maxCount, selectedMetric]);

  const hexagonLayer = useMemo(() => new GeoJsonLayer({
    id: 'hexagons',
    data: hexData || { type: 'FeatureCollection', features: [] },
    filled: true,
    getFillColor: getHexagonColor,
    stroked: true,
    getLineColor: [0, 0, 0, 80],
    lineWidthMinPixels: 1,
    pickable: true,
    visible: showHexagons,
    autoHighlight: true,
    onHover: (info: any) => {
      setHoverInfo(info.object ? {
        object: info.object,
        x: info.x,
        y: info.y
      } : null);
    },
    transitions: {
      getFillColor: 300
    },
    updateTriggers: {
      getFillColor: [maxCount, selectedMetric, getHexagonColor]
    }
  }), [hexData, getHexagonColor, maxCount, showHexagons, selectedMetric]);

  const uploadedGeoJSONLayer = useMemo(() => {
    if (!uploadedGeoJSON) return null;
    
    return new GeoJsonLayer({
      id: 'uploaded-geojson',
      data: uploadedGeoJSON,
      filled: true,
      getFillColor: [0, 150, 255, 100],
      stroked: true,
      getLineColor: [0, 100, 200, 200],
      lineWidthMinPixels: 2,
      pickable: true,
      visible: showUploadedGeoJSON,
      autoHighlight: true,
      highlightColor: [255, 200, 0, 200],
      onHover: (info: any) => {
        if (info.object) {
          setHoverInfo({
            object: info.object,
            x: info.x,
            y: info.y
          });
        }
      }
    });
  }, [uploadedGeoJSON, showUploadedGeoJSON]);

  const layers = useMemo(() => {
    const allLayers = [basemapLayer, hexagonLayer];
    if (uploadedGeoJSONLayer) {
      allLayers.push(uploadedGeoJSONLayer);
    }
    return allLayers;
  }, [basemapLayer, hexagonLayer, uploadedGeoJSONLayer]);

  const renderTooltip = () => {
    if (!hoverInfo) return null;
    
    const { object, x, y } = hoverInfo;
    
    let tooltipContent;
    if (object.properties?.count !== undefined) {
      tooltipContent = (
        <>
          <div>Total Boreholes: {object.properties.count}</div>
          <div>AGS Boreholes: {object.properties.AGS_count}</div>
          <div>AGS Percentage: {object.properties.AGS_Percentage.toFixed(1)}%</div>
        </>
      );
    } else if (object.properties) {
      tooltipContent = (
        <>
          {Object.entries(object.properties).map(([key, value]) => (
            <div key={key}>{key}: {String(value)}</div>
          ))}
        </>
      );
    }
    
    return (
      <div className="absolute pointer-events-none z-10 bg-white p-2 rounded shadow-md text-xs"
           style={{ left: x, top: y }}>
        {tooltipContent}
      </div>
    );
  };

  // Calculate effective sidebar width based on collapsed state
  const effectiveSidebarWidth = useMemo(() => {
    // If the sidebar width is small (48px for collapsed state), use that value
    // Otherwise use the full width
    return sidebarWidth < 50 ? sidebarWidth : sidebarWidth;
  }, [sidebarWidth]);

  return (
    <>
      <DeckGL
        initialViewState={initialViewState}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller
        layers={layers}
      />
      <LayerControl
        showBasemap={showBasemap}
        showHexagons={showHexagons}
        showUploadedGeoJSON={showUploadedGeoJSON}
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        onToggleBasemap={() => setShowBasemap(!showBasemap)}
        onToggleHexagons={() => setShowHexagons(!showHexagons)}
        onToggleUploadedGeoJSON={() => setShowUploadedGeoJSON(!showUploadedGeoJSON)}
        hasUploadedData={!!uploadedGeoJSON}
      />
      <Legend />
      <ScaleBar 
        latitude={viewState.latitude} 
        zoom={viewState.zoom} 
        resolution={currentResolution}
        sidebarWidth={effectiveSidebarWidth}
      />
      {renderTooltip()}
    </>
  );
}