import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { MapViewState } from '@deck.gl/core';
import { GeoJsonLayer, BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { FeatureCollection, Geometry } from 'geojson';
import { cellToBoundary } from 'h3-js';
import * as wellknown from 'wellknown';

// Calculate offset for the initial view to account for sidebar
const SIDEBAR_WIDTH_PIXELS = 320;
const calculateLongitudeOffset = (latitude: number, zoom: number): number => {
  const pixelsPerLongitudeDegree = Math.cos(latitude * Math.PI / 180) * 111000 * Math.pow(2, zoom) / 256;
  return (SIDEBAR_WIDTH_PIXELS / 2) / pixelsPerLongitudeDegree;
};

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -2.5 + calculateLongitudeOffset(54.0, 5),
  latitude: 54.0,
  zoom: 5,
  pitch: 0,
  bearing: 0
};

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
  <div style={{
    position: 'absolute',
    bottom: '32px',
    right: '32px',
    background: 'white',
    padding: '16px',
    borderRadius: '6px',
    boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
    zIndex: 1,
    minWidth: '240px',
  }}>
    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>Borehole Density</h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ 
        width: '100%', 
        height: '24px',
        background: 'linear-gradient(to right, rgb(65,182,196), rgb(127,205,187), rgb(199,233,180), rgb(252,174,145), rgb(215,25,28))',
        borderRadius: '4px'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px', color: '#555' }}>
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
  <div style={{
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'white',
    padding: '12px',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    zIndex: 1,
  }}>
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block' }}>Color By:</label>
      <select 
        value={selectedMetric} 
        onChange={(e) => onMetricChange(e.target.value)}
        style={{
          width: '100%',
          padding: '4px',
          borderRadius: '4px'
        }}
      >
        <option value="count">Total Boreholes</option>
        <option value="AGS_count">AGS Boreholes</option>
        <option value="AGS_Percentage">AGS Percentage</option>
      </select>
    </div>
    <div style={{ marginBottom: '8px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showBasemap}
          onChange={onToggleBasemap}
        />
        Basemap
      </label>
    </div>
    <div style={{ marginBottom: '8px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
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

interface MapComponentProps {
  uploadedGeoJSON?: any;
}

export default function MapComponent({ uploadedGeoJSON }: MapComponentProps) {
  const [currentResolution, setCurrentResolution] = useState(getResolutionForZoom(INITIAL_VIEW_STATE.zoom));
  const [hexData, setHexData] = useState<FeatureCollection<Geometry> | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [maxCount, setMaxCount] = useState(100);
  const [showBasemap, setShowBasemap] = useState(true);
  const [showHexagons, setShowHexagons] = useState(true);
  const [showUploadedGeoJSON, setShowUploadedGeoJSON] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{object: any; x: number; y: number} | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('count');

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
        {tooltipContent}
      </div>
    );
  };

  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
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
      {renderTooltip()}
    </>
  );
}