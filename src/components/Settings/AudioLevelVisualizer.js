import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Square, ChevronDown, Settings, BarChart3, Bluetooth, Save, Maximize2 } from 'lucide-react';
import Button from '../ui/Button';
import cardStyles from '../ui/Card.module.css';
import formStyles from '../ui/Form.module.css';
import navStyles from '../ui/Navigation.module.css';
import styles from '../ui/AudioLevelVisualizer.module.css';

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

  return (
    <div className={styles.root} data-visualizer-theme={theme}>
      <div className={cardStyles.card}>
        {/* Header */}
        <div className="rowBetweenStart">
          <div className="row">
            <div className={styles.headerIcon}>
              <Volume2 size={24} />
            </div>
            <div>
              <h1>Audio Level Visualizer</h1>
              <p className={cardStyles.description}>Professional studio quality</p>
            </div>
          </div>
          <div className="row">
            <Button onClick={toggleTheme} size="icon" aria-label="Toggle visualizer theme">
              {theme === 'dark' ? '🌙' : '☀️'}
            </Button>
            <Button onClick={toggleRecording} variant={isRecording ? 'danger' : 'success'}>
              {isRecording ? 'Stop' : 'Start'}
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className={navStyles.subnav}>
          <button
            onClick={() => setActiveTab('levels')}
            className={`${navStyles.tab} ${activeTab === 'levels' ? navStyles.active : ''}`}
          >
            Audio Levels
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`${navStyles.tab} ${activeTab === 'settings' ? navStyles.active : ''}`}
          >
            <span className="row">
              <Settings size={14} />
              Settings
            </span>
          </button>
        </div>
        
        {activeTab === 'levels' ? (
          <div className="stackLarge">
            <div className={styles.controlsGrid}>
              <div className={`${cardStyles.card} ${cardStyles.compact} ${styles.triggerControl}`}>
                <span>Recording Trigger Level:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={triggerLevel}
                  onChange={handleTriggerChange}
                  className={formStyles.range}
                />
                <span className={styles.monoValue}>{triggerLevel.toFixed(1)}</span>
              </div>
              <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                <div className="rowBetween">
                  <span>Gain:</span>
                  <div className={styles.dropdownAnchor}>
                    <Button onClick={() => setShowGainDropdown(!showGainDropdown)} size="small">
                      <span>{gain}</span>
                      <ChevronDown size={16} />
                    </Button>
                    {showGainDropdown && (
                      <div className={styles.dropdown}>
                        {gainOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={styles.dropdownOption}
                            onClick={() => selectGain(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.visualizer}>
              <div className={styles.scale}>
                <div>100</div>
                <div>80</div>
                <div>10</div>
                <div>0</div>
              </div>
              <div className={styles.visualizerToolbar}>
                <Button onClick={toggleVisualMode} size="small">
                  <BarChart3 size={14} />
                  <span>{visualMode === 'bars' ? 'Bar View' : 'Wave View'}</span>
                </Button>
                <div className="row">
                  <Button size="icon" aria-label="Save visualization"><Save size={14} /></Button>
                  <Button size="icon" aria-label="Expand visualization"><Maximize2 size={14} /></Button>
                </div>
              </div>
              <div className={styles.canvasFrame}>
                <canvas ref={canvasRef} className={styles.canvas} />
              </div>
            </div>
            
            <div className="gridThree">
              <div className={`${cardStyles.card} ${cardStyles.compact}`}>
                <h3 className={cardStyles.description}>Current Values</h3>
                <div className="rowBetween">
                  <div><div className={styles.monoValue}>{currentRMS.toFixed(1)}</div><div className={cardStyles.description}>RMS</div></div>
                  <div><div className={styles.monoValue}>{currentLevel.toFixed(1)}</div><div className={cardStyles.description}>Level</div></div>
                </div>
              </div>
              <div className={`${cardStyles.card} ${cardStyles.compact} ${styles.metricCard}`}>
                <h3 className={cardStyles.description}>Current Level</h3>
                <div className={styles.metricValue}>{currentDisplay.toFixed(1)}</div>
              </div>
              <div className={`${cardStyles.card} ${cardStyles.compact} ${styles.metricCard}`}>
                <h3 className={cardStyles.description}>Peak Level</h3>
                <div className={styles.metricValue}>{peakLevel.toFixed(1)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`${cardStyles.card} ${cardStyles.compact}`}>
            <h2>Advanced Settings</h2>
            <div className="stackLarge">
              <div className="rowBetween">
                <div><h3>Visualization Mode</h3><p className={cardStyles.description}>Choose how audio levels are displayed</p></div>
                <Button onClick={toggleVisualMode}><BarChart3 size={16} /><span>{visualMode === 'bars' ? 'Bar Mode' : 'Wave Mode'}</span></Button>
              </div>
              <hr className="divider" />
              <div className="rowBetween">
                <div><h3>Bluetooth Audio Input</h3><p className={cardStyles.description}>Connect to Bluetooth audio source</p></div>
                <Button><Bluetooth size={16} /><span>Connect</span></Button>
              </div>
              <hr className="divider" />
              <div className="rowBetween">
                <div><h3>Color Theme</h3><p className={cardStyles.description}>Choose light or dark mode</p></div>
                <Button onClick={toggleTheme}><span>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span></Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div className={styles.footer}>
          <p>Audio Level Visualizer Pro • 2025 Edition</p>
        </div>
      </div>
    </div>
  );
};

export default AudioLevelVisualizer;
