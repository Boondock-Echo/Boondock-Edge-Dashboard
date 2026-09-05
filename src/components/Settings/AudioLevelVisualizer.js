import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Square, ChevronDown, Settings, BarChart3, Bluetooth, Save, Maximize2 } from 'lucide-react';

const AudioLevelVisualizer = () => {
  // State for the component
  const [isRecording, setIsRecording] = useState(true);
  const [triggerLevel, setTriggerLevel] = useState(10.0);
  const [gain, setGain] = useState('6 dB');
  const [currentRMS, setCurrentRMS] = useState(4722.8);
  const [currentLevel, setCurrentLevel] = useState(46.7);
  const [currentDisplay, setCurrentDisplay] = useState(10.0);
  const [peakLevel, setPeakLevel] = useState(66.6);
  const [showGainDropdown, setShowGainDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('levels');
  const [visualMode, setVisualMode] = useState('bars');
  const [theme, setTheme] = useState('dark');
  
  // Refs for animation
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // Mock data for the visualization
  const generateMockData = () => {
    const data = [];
    const barCount = 40;
    
    for (let i = 0; i < barCount; i++) {
      // Generate more realistic audio-like pattern
      let height = Math.random() * 5; // Base noise level
      
      // Occasionally add taller bars to simulate speech/audio peaks
      if (Math.random() > 0.7) {
        height = 5 + Math.random() * 70;
      }
      
      data.push(height);
    }
    return data;
  };
  
  // Animation function for the visualizer
  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background zones with gradient
    const tooLoudHeight = height * 0.15;
    const goodHeight = height * 0.65;
    const tooQuietHeight = height * 0.2;
    
    // Create gradients
    const loudGradient = ctx.createLinearGradient(0, 0, width, tooLoudHeight);
    loudGradient.addColorStop(0, '#1e2d5f');
    loudGradient.addColorStop(1, '#2a3d7a');
    
    const goodGradient = ctx.createLinearGradient(0, tooLoudHeight, width, tooLoudHeight + goodHeight);
    goodGradient.addColorStop(0, '#1b4632');
    goodGradient.addColorStop(1, '#2a6148');
    
    const quietGradient = ctx.createLinearGradient(0, tooLoudHeight + goodHeight, width, height);
    quietGradient.addColorStop(0, '#4d1d25');
    quietGradient.addColorStop(1, '#5e2a33');
    
    // Too loud zone (gradient blue)
    ctx.fillStyle = loudGradient;
    ctx.fillRect(0, 0, width, tooLoudHeight);
    
    // Good zone (gradient green)
    ctx.fillStyle = goodGradient;
    ctx.fillRect(0, tooLoudHeight, width, goodHeight);
    
    // Too quiet zone (gradient red)
    ctx.fillStyle = quietGradient;
    ctx.fillRect(0, tooLoudHeight + goodHeight, width, tooQuietHeight);
    
    // Zone labels with glow effect
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    // Too loud label with glow
    ctx.fillStyle = '#e85757';
    ctx.shadowColor = '#e85757';
    ctx.shadowBlur = 10;
    ctx.fillText('TOO LOUD', width / 2, tooLoudHeight / 2 + 5);
    
    // Good label with glow
    ctx.fillStyle = '#4caf50';
    ctx.shadowColor = '#4caf50';
    ctx.shadowBlur = 10;
    ctx.fillText('GOOD', width / 2, tooLoudHeight + goodHeight / 2);
    
    // Too quiet label with glow
    ctx.fillStyle = '#9c64ff';
    ctx.shadowColor = '#9c64ff';
    ctx.shadowBlur = 10;
    ctx.fillText('TOO QUIET', width / 2, tooLoudHeight + goodHeight + tooQuietHeight / 2 + 5);
    ctx.shadowBlur = 0;
    
    // Draw horizontal lines at zone boundaries
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    
    // Line at top of good zone
    ctx.beginPath();
    ctx.moveTo(0, tooLoudHeight);
    ctx.lineTo(width, tooLoudHeight);
    ctx.stroke();
    
    // Line at bottom of good zone
    ctx.beginPath();
    ctx.moveTo(0, tooLoudHeight + goodHeight);
    ctx.lineTo(width, tooLoudHeight + goodHeight);
    ctx.stroke();
    
    // Trigger level line with animation effect
    const triggerY = height - (triggerLevel / 100) * height;
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, triggerY);
    ctx.lineTo(width, triggerY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw the visualization based on selected mode
    const barData = generateMockData();
    
    if (visualMode === 'bars') {
      // Traditional bar visualizer
      const barWidth = width / barData.length - 2;
      
      barData.forEach((value, index) => {
        const barHeight = (value / 100) * height;
        const x = index * (barWidth + 2);
        const y = height - barHeight;
        
        // Gradient color based on height
        const barGradient = ctx.createLinearGradient(0, y, 0, height);
        
        if (value > 80) {
          barGradient.addColorStop(0, '#ff3d3d');
          barGradient.addColorStop(1, '#ff7070');
        } else if (value > 5) {
          barGradient.addColorStop(0, '#ff9234');
          barGradient.addColorStop(1, '#ffb06b');
        } else {
          barGradient.addColorStop(0, '#ffeb3b');
          barGradient.addColorStop(1, '#fff59d');
        }
        
        ctx.fillStyle = barGradient;
        
        // Rounded tops
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x, y + barHeight - 2);
        ctx.arcTo(x, y + barHeight, x + 2, y + barHeight, 2);
        ctx.lineTo(x + barWidth - 2, y + barHeight);
        ctx.arcTo(x + barWidth, y + barHeight, x + barWidth, y + barHeight - 2, 2);
        ctx.lineTo(x + barWidth, y + 2);
        ctx.arcTo(x + barWidth, y, x + barWidth - 2, y, 2);
        ctx.lineTo(x + 2, y);
        ctx.arcTo(x, y, x, y + 2, 2);
        ctx.fill();
        
        // Add glow effect
        ctx.shadowColor = barGradient;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, y, barWidth, 1);
        ctx.shadowBlur = 0;
      });
    } else if (visualMode === 'wave') {
      // Wave visualizer
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      barData.forEach((value, index) => {
        const x = index * (width / barData.length);
        const y = height - (value / 100) * height;
        
        if (index === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.quadraticCurveTo(
            x - (width / barData.length) / 2, 
            height - (barData[index - 1] / 100) * height,
            x, 
            y
          );
        }
      });
      
      ctx.lineTo(width, height);
      ctx.closePath();
      
      // Create gradient for wave
      const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
      waveGradient.addColorStop(0, '#3498db');
      waveGradient.addColorStop(0.5, '#5dade2');
      waveGradient.addColorStop(1, 'rgba(84, 153, 199, 0.2)');
      
      ctx.fillStyle = waveGradient;
      ctx.fill();
      
      // Add glow effect to wave top
      ctx.strokeStyle = '#5dade2';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#3498db';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(0, height - (barData[0] / 100) * height);
      
      barData.forEach((value, index) => {
        const x = index * (width / barData.length);
        const y = height - (value / 100) * height;
        
        if (index === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.quadraticCurveTo(
            x - (width / barData.length) / 2, 
            height - (barData[index - 1] / 100) * height,
            x, 
            y
          );
        }
      });
      
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // Update some of the display values randomly to simulate changing audio
    if (Math.random() > 0.7) {
      setCurrentRMS(Math.floor(4000 + Math.random() * 1000));
      setCurrentLevel(Math.floor(40 + Math.random() * 20));
      setCurrentDisplay(Math.floor(5 + Math.random() * 15));
      if (Math.random() > 0.9) {
        setPeakLevel(Math.floor(60 + Math.random() * 20));
      }
    }
    
    // Continue animation if recording
    if (isRecording) {
      animationRef.current = requestAnimationFrame(drawVisualizer);
    }
  };
  
  // Handle starting/stopping the visualizer
  useEffect(() => {
    if (isRecording) {
      animationRef.current = requestAnimationFrame(drawVisualizer);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, visualMode]);
  
  // Initialize canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set canvas dimensions to match container size with higher pixel density
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      
      // Start animation
      animationRef.current = requestAnimationFrame(drawVisualizer);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };
  
  const handleTriggerChange = (e) => {
    setTriggerLevel(parseFloat(e.target.value));
  };
  
  const selectGain = (value) => {
    setGain(value);
    setShowGainDropdown(false);
  };
  
  const toggleVisualMode = () => {
    setVisualMode(visualMode === 'bars' ? 'wave' : 'bars');
  };
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  const gainOptions = ['0 dB', '3 dB', '6 dB', '9 dB', '12 dB', '15 dB'];
  
  const themeClass = theme === 'dark' 
    ? 'bg-gray-900 text-white'
    : 'bg-white text-slate-800';
  
  const cardClass = theme === 'dark'
    ? 'bg-gray-900/60 border-gray-800'
    : 'bg-white border-gray-200';
  
  return (
    <div className={`${themeClass} p-0 w-full max-w-4xl mx-auto transition-all duration-300`}>
      <div className={`rounded-2xl shadow-lg border p-4 ${cardClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg shadow-lg bg-blue-600">
              <Volume2 className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Audio Level Visualizer</h1>
              <p className="text-sm opacity-70">Professional studio quality</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-md transition-all ${theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-blue-100 hover:bg-blue-200'}`}
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>
            
            <button
              onClick={toggleRecording}
              className={`px-4 py-2 rounded-md font-medium transition-all duration-300 shadow-lg ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isRecording ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('levels')}
            className={`px-4 py-2 font-medium transition-all ${activeTab === 'levels' 
              ? 'border-b-2 border-blue-500 text-blue-500' 
              : 'hover:text-blue-400 opacity-70'}`}
          >
            Audio Levels
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 font-medium transition-all ${activeTab === 'settings' 
              ? 'border-b-2 border-blue-500 text-blue-500' 
              : 'hover:text-blue-400 opacity-70'}`}
          >
            <div className="flex items-center">
              <Settings size={14} className="mr-1" />
              Settings
            </div>
          </button>
        </div>
        
        {activeTab === 'levels' ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className={`md:col-span-3 ${cardClass} p-4 rounded-lg flex items-center transition-all duration-300`}>
                <span className="text-gray-400 whitespace-nowrap mr-3">Recording Trigger Level:</span>
                <div className="relative w-full flex-1 mr-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={triggerLevel}
                    onChange={handleTriggerChange}
                    className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer"
                  />
                  <div 
                    className="absolute h-2 bg-blue-500 rounded-l-lg" 
                    style={{ width: `${triggerLevel}%`, top: '50%', transform: 'translateY(-50%)' }}
                  ></div>
                  <div 
                    className="absolute w-5 h-5 bg-white rounded-full shadow-lg cursor-pointer"
                    style={{ left: `${triggerLevel}%`, top: '50%', transform: 'translateY(-50%)', boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}
                  >
                    <div className="absolute inset-1 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
                <span className="text-blue-400 font-mono min-w-12 text-right">{triggerLevel.toFixed(1)}</span>
              </div>
              
              <div className={`${cardClass} p-4 rounded-lg transition-all duration-300`}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Gain:</span>
                  <div className="relative">
                    <button
                      onClick={() => setShowGainDropdown(!showGainDropdown)}
                      className={`${theme === 'dark' ? 'bg-slate-700' : 'bg-blue-100'} px-3 py-1 rounded flex items-center justify-between min-w-24 transition-all hover:bg-opacity-80`}
                    >
                      <span>{gain}</span>
                      <ChevronDown size={16} />
                    </button>
                    
                    {showGainDropdown && (
                      <div className={`absolute right-0 mt-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-white'} rounded-md shadow-lg z-10 w-24 border ${theme === 'dark' ? 'border-slate-600' : 'border-gray-200'}`}>
                        {gainOptions.map((option) => (
                          <div
                            key={option}
                            className={`px-3 py-2 ${theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-blue-50'} cursor-pointer text-sm transition-all`}
                            onClick={() => selectGain(option)}
                          >
                            {option}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`relative mb-6 ${cardClass} rounded-lg overflow-hidden shadow-lg transition-all duration-300`}>
              <div className="absolute left-0 top-0 w-10 h-full flex flex-col justify-between p-2 text-xs text-gray-400 font-mono bg-opacity-70">
                <div>100</div>
                <div>80</div>
                <div>10</div>
                <div>0</div>
              </div>
              
              <div className="flex justify-between items-center p-2 border-b border-gray-700/30">
                <button
                  onClick={toggleVisualMode}
                  className={`text-xs flex items-center space-x-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-blue-100'} px-2 py-1 rounded`}
                >
                  <BarChart3 size={14} />
                  <span>{visualMode === 'bars' ? 'Bar View' : 'Wave View'}</span>
                </button>
                
                <div className="flex space-x-2">
                  <button className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-blue-100'} transition-all`}>
                    <Save size={14} />
                  </button>
                  <button className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-blue-100'} transition-all`}>
                    <Maximize2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="ml-10 h-64">
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${cardClass} p-4 rounded-lg transition-all duration-300 transform hover:scale-105`}>
                <h3 className="text-gray-400 text-sm mb-2">Current Values</h3>
                <div className="flex justify-between">
                  <div>
                    <div className="text-2xl font-mono text-green-400">{currentRMS.toFixed(1)}</div>
                    <div className="text-sm text-gray-400">RMS</div>
                  </div>
                  <div>
                    <div className="text-2xl font-mono text-orange-400">{currentLevel.toFixed(1)}</div>
                    <div className="text-sm text-gray-400">Level</div>
                  </div>
                </div>
              </div>
              
              <div className={`${cardClass} p-4 rounded-lg flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-105`}>
                <h3 className="text-gray-400 text-sm mb-2">Current Level</h3>
                <div className="text-3xl font-mono relative">
                  <span className="text-orange-400">{currentDisplay.toFixed(1)}</span>
                  <div className="absolute -bottom-3 left-0 w-full h-1 bg-orange-400 rounded-full opacity-50"></div>
                </div>
              </div>
              
              <div className={`${cardClass} p-4 rounded-lg flex flex-col items-center justify-center transition-all duration-300 transform hover:scale-105`}>
                <h3 className="text-gray-400 text-sm mb-2">Peak Level</h3>
                <div className="text-3xl font-mono relative">
                  <span className="text-red-500">{peakLevel.toFixed(1)}</span>
                  <div className="absolute -bottom-3 left-0 w-full h-1 bg-red-500 rounded-full opacity-50"></div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={`${cardClass} p-6 rounded-lg mb-6 transition-all duration-300`}>
            <h2 className="text-xl font-bold mb-4">Advanced Settings</h2>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Visualization Mode</h3>
                  <p className="text-sm text-gray-400">Choose how audio levels are displayed</p>
                </div>
                <button
                  onClick={toggleVisualMode}
                  className={`${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-blue-100'
                  } px-3 py-2 rounded-lg flex items-center space-x-2`}
                >
                  <BarChart3 size={16} />
                  <span>{visualMode === 'bars' ? 'Bar Mode' : 'Wave Mode'}</span>
                </button>
              </div>
              
              <div className="border-t border-gray-700/30 pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Bluetooth Audio Input</h3>
                    <p className="text-sm text-gray-400">Connect to Bluetooth audio source</p>
                  </div>
                  <button className={`${theme === 'dark' ? 'bg-slate-700' : 'bg-blue-100'} px-3 py-2 rounded-lg flex items-center space-x-2`}>
                    <Bluetooth size={16} />
                    <span>Connect</span>
                  </button>
                </div>
              </div>
              
              <div className="border-t border-gray-700/30 pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Color Theme</h3>
                    <p className="text-sm text-gray-400">Choose light or dark mode</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`${theme === 'dark' ? 'bg-slate-700' : 'bg-blue-100'} px-3 py-2 rounded-lg flex items-center space-x-2`}
                  >
                    <span>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Audio Level Visualizer Pro • 2025 Edition</p>
        </div>
      </div>
    </div>
  );
};

export default AudioLevelVisualizer;