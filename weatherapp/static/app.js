class WeatherLux {
  constructor() {
    this.currentCity = '';
    this.currentType = 'weather';
    this.isLoading = false;
    
    this.initializeElements();
    this.bindEvents();
    this.updateStatus('Ready', 'success');
  }

  initializeElements() {
    this.elements = {
      cityInput: document.getElementById('cityInput'),
      getWeatherBtn: document.getElementById('getWeatherBtn'),
      getForecastBtn: document.getElementById('getForecastBtn'),
      weatherResult: document.getElementById('weatherResult'),
      loadingState: document.getElementById('loadingState'),
      status: document.getElementById('status'),
      responseTime: document.getElementById('responseTime'),
      resultsTitle: document.getElementById('resultsTitle'),
      resultsIcon: document.getElementById('resultsIcon'),
      refreshBtn: document.getElementById('refreshBtn'),
      copyBtn: document.getElementById('copyBtn'),
      clearBtn: document.getElementById('clearBtn'),
      toastContainer: document.getElementById('toastContainer')
    };
  }

  bindEvents() {
    // Input events
    this.elements.cityInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isLoading) {
        this.fetchWeather();
      }
    });

    this.elements.cityInput.addEventListener('input', (e) => {
      this.currentCity = e.target.value.trim();
    });

    // Button events
    this.elements.getWeatherBtn.addEventListener('click', () => {
      if (!this.isLoading) this.fetchWeather();
    });
    
    this.elements.getForecastBtn.addEventListener('click', () => {
      if (!this.isLoading) this.fetchForecast();
    });
    
    // Action buttons
    this.elements.refreshBtn.addEventListener('click', () => this.refreshData());
    this.elements.copyBtn.addEventListener('click', () => this.copyResults());
    this.elements.clearBtn.addEventListener('click', () => this.clearResults());

    // Add button animations
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', this.createButtonAnimation);
    });
  }

  createButtonAnimation(e) {
    const btn = e.currentTarget;
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 150);
  }

  async fetchWeather() {
    const city = this.currentCity || this.elements.cityInput.value.trim();
    if (!city) {
      this.showToast('Please enter a city name', 'error');
      this.elements.cityInput.focus();
      return;
    }

    this.startLoading('Fetching current weather data...');
    this.updateStatus('Loading...', 'loading');
    this.currentType = 'weather';

    const startTime = performance.now();
    
    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      this.elements.responseTime.textContent = `${responseTime}ms`;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.text();
      this.displayWeatherData(data, city);
      
      this.currentCity = city;
      this.updateStatus('Connected', 'success');
      this.updateResultsHeader('🌤️', 'Current Weather');
      this.showToast(`Weather data loaded in ${responseTime}ms`, 'success');
      
    } catch (error) {
      console.error('Weather fetch error:', error);
      this.displayError(`Failed to fetch weather data: ${error.message}`);
      this.updateStatus('Error', 'error');
      this.showToast('Failed to fetch weather data', 'error');
    } finally {
      this.stopLoading();
    }
  }

  async fetchForecast() {
    const city = this.currentCity || this.elements.cityInput.value.trim();
    if (!city) {
      this.showToast('Please enter a city name', 'error');
      this.elements.cityInput.focus();
      return;
    }

    this.startLoading('Fetching 5-day forecast...');
    this.updateStatus('Loading...', 'loading');
    this.currentType = 'forecast';

    const startTime = performance.now();
    
    try {
      const response = await fetch(`/api/forecast?city=${encodeURIComponent(city)}`);
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      
      this.elements.responseTime.textContent = `${responseTime}ms`;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.text();
      this.displayForecastData(data, city);
      
      this.currentCity = city;
      this.updateStatus('Connected', 'success');
      this.updateResultsHeader('📊', '5-Day Forecast');
      this.showToast(`Forecast loaded in ${responseTime}ms`, 'success');
      
    } catch (error) {
      console.error('Forecast fetch error:', error);
      this.displayError(`Failed to fetch forecast: ${error.message}`);
      this.updateStatus('Error', 'error');
      this.showToast('Failed to fetch forecast data', 'error');
    } finally {
      this.stopLoading();
    }
  }

  displayWeatherData(rawData, city) {
    // Parse the raw data
    const lines = rawData.split('\n').filter(line => line.trim());
    const weatherInfo = this.parseWeatherData(lines);

    const weatherHTML = `
      <div class="weather-data">
        <div class="weather-header">
          <div class="location-info">
            <h2>${weatherInfo.city}</h2>
            <div class="location-details">
              <span>📍 ${weatherInfo.coordinates}</span>
              <span class="separator">•</span>
              <span>⏰ ${new Date().toLocaleString()}</span>
            </div>
          </div>
          <div class="weather-icon">
            ${this.getWeatherEmoji(weatherInfo.description)}
          </div>
        </div>

        <div class="weather-metrics">
          <div class="metric-card">
            <div class="metric-label">
              <span class="metric-icon">🌡️</span>
              Temperature
            </div>
            <div class="metric-value">
              ${weatherInfo.temperature}
              <span class="metric-unit">°C</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">
              <span class="metric-icon">🤏</span>
              Feels Like
            </div>
            <div class="metric-value">
              ${weatherInfo.feelsLike || weatherInfo.temperature}
              <span class="metric-unit">°C</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">
              <span class="metric-icon">💧</span>
              Humidity
            </div>
            <div class="metric-value">
              ${weatherInfo.humidity}
              <span class="metric-unit">%</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">
              <span class="metric-icon">🔽</span>
              Pressure
            </div>
            <div class="metric-value">
              ${weatherInfo.pressure || 'N/A'}
              <span class="metric-unit">${weatherInfo.pressure ? 'hPa' : ''}</span>
            </div>
          </div>
        </div>

        <div class="additional-info">
          <div class="info-item">
            <span class="info-icon">☁️</span>
            <span>${weatherInfo.description}</span>
          </div>
          ${weatherInfo.wind ? `
            <div class="info-item">
              <span class="info-icon">💨</span>
              <span>${weatherInfo.wind}</span>
            </div>
          ` : ''}
          ${weatherInfo.visibility ? `
            <div class="info-item">
              <span class="info-icon">👁️</span>
              <span>${weatherInfo.visibility}</span>
            </div>
          ` : ''}
          ${weatherInfo.sunrise ? `
            <div class="info-item">
              <span class="info-icon">🌅</span>
              <span>Sunrise: ${weatherInfo.sunrise}</span>
            </div>
          ` : ''}
          ${weatherInfo.sunset ? `
            <div class="info-item">
              <span class="info-icon">🌇</span>
              <span>Sunset: ${weatherInfo.sunset}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.elements.weatherResult.innerHTML = weatherHTML;
  }

  displayForecastData(rawData, city) {
    const lines = rawData.split('\n').filter(line => line.trim());
    const forecastInfo = this.parseForecastData(lines);

    const forecastHTML = `
      <div class="weather-data">
        <div class="weather-header">
          <div class="location-info">
            <h2>${forecastInfo.city}</h2>
            <div class="location-details">
              <span>📊 5-Day Weather Forecast</span>
              <span class="separator">•</span>
              <span>⏰ ${new Date().toLocaleString()}</span>
            </div>
          </div>
          <div class="weather-icon">📈</div>
        </div>

        <div class="forecast-container">
          ${forecastInfo.days.map(day => `
            <div class="forecast-day">
              <div class="day-header">
                <h3>${day.title}</h3>
                <div class="day-icon">${this.getWeatherEmoji(day.items[0]?.description || 'clear')}</div>
              </div>
              <div class="forecast-items">
                ${day.items.map(item => `
                  <div class="forecast-item">
                    <div class="forecast-time">${item.time}</div>
                    <div class="forecast-temp">${item.temperature}°C</div>
                    <div class="forecast-desc">${item.description}</div>
                    ${item.humidity ? `<div class="forecast-humidity">💧 ${item.humidity}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.elements.weatherResult.innerHTML = forecastHTML;

    // Add forecast-specific styles
    if (!document.getElementById('forecast-styles')) {
      const style = document.createElement('style');
      style.id = 'forecast-styles';
      style.textContent = `
        .forecast-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }
        
        .forecast-day {
          background: var(--surface-secondary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .day-header {
          background: var(--primary-gradient);
          padding: var(--space-lg);
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
        }
        
        .day-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
        }
        
        .day-icon {
          font-size: 2rem;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        
        .forecast-items {
          padding: var(--space-lg);
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-md);
        }
        
        .forecast-item {
          background: var(--surface-primary);
          padding: var(--space-md);
          border-radius: var(--radius-md);
          text-align: center;
          transition: transform 0.2s ease;
        }
        
        .forecast-item:hover {
          transform: translateY(-2px);
        }
        
        .forecast-time {
          font-weight: 600;
          color: var(--primary-color);
          margin-bottom: var(--space-xs);
        }
        
        .forecast-temp {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: var(--space-xs);
        }
        
        .forecast-desc {
          color: var(--text-secondary);
          font-size: 0.875rem;
          text-transform: capitalize;
          margin-bottom: var(--space-xs);
        }
        
        .forecast-humidity {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        
        @media (max-width: 768px) {
          .forecast-items {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  parseWeatherData(lines) {
    const data = {};
    
    for (const line of lines) {
      if (line.includes('📍 Location:')) {
        const match = line.match(/📍 Location: (.+)/);
        if (match) data.city = match[1];
      } else if (line.includes('🌐 Coordinates:')) {
        const match = line.match(/🌐 Coordinates: (.+)/);
        if (match) data.coordinates = match[1];
      } else if (line.includes('🌡️ Temperature:')) {
        const match = line.match(/🌡️ Temperature: ([\d.-]+)°C/);
        if (match) data.temperature = match[1];
        const feelsMatch = line.match(/feels like ([\d.-]+)°C/);
        if (feelsMatch) data.feelsLike = feelsMatch[1];
      } else if (line.includes('💧 Humidity:')) {
        const match = line.match(/💧 Humidity: (\d+)%/);
        if (match) data.humidity = match[1];
      } else if (line.includes('🔽 Pressure:')) {
        const match = line.match(/🔽 Pressure: (\d+) hPa/);
        if (match) data.pressure = match[1];
      } else if (line.includes('☁️ Conditions:')) {
        const match = line.match(/☁️ Conditions: (.+)/);
        if (match) data.description = match[1];
      } else if (line.includes('💨 Wind:')) {
        const match = line.match(/💨 Wind: (.+)/);
        if (match) data.wind = match[1];
      } else if (line.includes('👁️ Visibility:')) {
        const match = line.match(/👁️ Visibility: (.+)/);
        if (match) data.visibility = match[1];
      } else if (line.includes('🌅 Sunrise:')) {
        const match = line.match(/🌅 Sunrise: (.+)/);
        if (match) data.sunrise = match[1];
      } else if (line.includes('🌇 Sunset:')) {
        const match = line.match(/🌇 Sunset: (.+)/);
        if (match) data.sunset = match[1];
      }
      
      // Fallback parsing for simple format
      if (line.includes('City:')) {
        const match = line.match(/City: (.+)/);
        if (match) data.city = match[1];
      } else if (line.includes('Temp:')) {
        const match = line.match(/Temp: ([\d.-]+)°C/);
        if (match) data.temperature = match[1];
      } else if (line.includes('Weather:')) {
        const match = line.match(/Weather: (.+)/);
        if (match) data.description = match[1];
      }
    }
    
    return data;
  }

  parseForecastData(lines) {
    const data = { city: '', days: [] };
    let currentDay = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('5-Day Forecast for')) {
        const match = line.match(/5-Day Forecast for (.+)/);
        if (match) data.city = match[1].split(',')[0];
      } else if (line.includes('Day ') && line.includes('Forecast:')) {
        if (currentDay) data.days.push(currentDay);
        const dayMatch = line.match(/Day (\d+) Forecast:/);
        currentDay = {
          title: `Day ${dayMatch ? dayMatch[1] : data.days.length + 1}`,
          items: []
        };
      } else if (line.match(/^\d{2}:\d{2}/)) {
        // Parse forecast items
        const parts = line.split(' | ');
        if (parts.length >= 3 && currentDay) {
          const time = parts[0];
          const tempMatch = parts[1].match(/([\d.-]+)°C/);
          const feelsMatch = parts[1].match(/feels ([\d.-]+)°C/);
          const humidityMatch = parts[2].match(/💧(\d+)%/);
          const description = parts[3] || parts[2];
          
          currentDay.items.push({
            time: time,
            temperature: tempMatch ? tempMatch[1] : 'N/A',
            feelsLike: feelsMatch ? feelsMatch[1] : null,
            humidity: humidityMatch ? humidityMatch[1] + '%' : null,
            description: description.replace(/💧\d+%/, '').replace(/💨[\d.]+ ?m\/s/, '').trim()
          });
        }
      }
    }
    
    if (currentDay) data.days.push(currentDay);
    
    return data;
  }

  getWeatherEmoji(description) {
    const desc = description.toLowerCase();
    if (desc.includes('clear') || desc.includes('sunny')) return '☀️';
    if (desc.includes('cloud')) return '☁️';
    if (desc.includes('rain') || desc.includes('shower')) return '🌧️';
    if (desc.includes('storm') || desc.includes('thunder')) return '⛈️';
    if (desc.includes('snow')) return '❄️';
    if (desc.includes('mist') || desc.includes('fog')) return '🌫️';
    if (desc.includes('wind')) return '💨';
    return '🌤️';
  }

  displayError(message) {
    const errorHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Unable to fetch weather data</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="weatherApp.refreshData()">
          <span class="btn-icon">🔄</span>
          Try Again
        </button>
      </div>
    `;
    
    this.elements.weatherResult.innerHTML = errorHTML;

    // Add error-specific styles
    if (!document.getElementById('error-styles')) {
      const style = document.createElement('style');
      style.id = 'error-styles';
      style.textContent = `
        .error-state {
          text-align: center;
          padding: var(--space-2xl);
          color: var(--text-secondary);
        }
        
        .error-icon {
          font-size: 4rem;
          margin-bottom: var(--space-lg);
          filter: drop-shadow(0 5px 15px rgba(255, 107, 157, 0.3));
        }
        
        .error-state h3 {
          font-size: 1.5rem;
          color: var(--text-primary);
          margin-bottom: var(--space-md);
        }
        
        .error-state p {
          margin-bottom: var(--space-xl);
          line-height: 1.6;
        }
      `;
      document.head.appendChild(style);
    }
  }

  startLoading(text = 'Loading...') {
    this.isLoading = true;
    this.elements.loadingState.classList.add('active');
    this.elements.loadingState.querySelector('.loading-text').textContent = text;
    
    // Disable buttons
    this.elements.getWeatherBtn.disabled = true;
    this.elements.getForecastBtn.disabled = true;
  }

  stopLoading() {
    this.isLoading = false;
    this.elements.loadingState.classList.remove('active');
    
    // Re-enable buttons
    this.elements.getWeatherBtn.disabled = false;
    this.elements.getForecastBtn.disabled = false;
  }

  updateStatus(status, type = 'info') {
    this.elements.status.textContent = status;
    this.elements.status.className = `stat-value status-indicator status-${type}`;
  }

  updateResultsHeader(icon, title) {
    this.elements.resultsIcon.textContent = icon;
    this.elements.resultsTitle.innerHTML = `<span class="results-icon">${icon}</span>${title}`;
  }

  refreshData() {
    if (this.currentCity) {
      if (this.currentType === 'forecast') {
        this.fetchForecast();
      } else {
        this.fetchWeather();
      }
    } else {
      this.showToast('No previous search to refresh', 'info');
    }
  }

  copyResults() {
    const resultText = this.elements.weatherResult.textContent || this.elements.weatherResult.innerText;
    if (resultText.trim()) {
      navigator.clipboard.writeText(resultText).then(() => {
        this.showToast('Results copied to clipboard', 'success');
      }).catch(() => {
        this.showToast('Failed to copy results', 'error');
      });
    } else {
      this.showToast('No data to copy', 'info');
    }
  }

  clearResults() {
    this.elements.weatherResult.innerHTML = `
      <div class="welcome-state">
        <div class="welcome-animation">
          <div class="floating-icon">🌤️</div>
        </div>
        <h3 class="welcome-title">Welcome to WeatherLux</h3>
        <p class="welcome-description">
          Experience premium weather intelligence with lightning-fast data from our Rust-powered backend.
          Enter any city above to get started.
        </p>
        <div class="feature-highlights">
          <div class="highlight">
            <span class="highlight-icon">⚡</span>
            <span>Ultra-fast processing</span>
          </div>
          <div class="highlight">
            <span class="highlight-icon">🌍</span>
            <span>Global coverage</span>
          </div>
          <div class="highlight">
            <span class="highlight-icon">📈</span>
            <span>Detailed analytics</span>
          </div>
        </div>
      </div>
    `;
    
    this.currentCity = '';
    this.elements.cityInput.value = '';
    this.elements.responseTime.textContent = '-';
    this.updateStatus('Ready', 'success');
    this.updateResultsHeader('🌍', 'Weather Data');
    this.showToast('Results cleared', 'info');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    this.elements.toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Initialize the app
const weatherApp = new WeatherLux();

// Add additional status classes to CSS if not already present
if (!document.getElementById('status-styles')) {
  const style = document.createElement('style');
  style.id = 'status-styles';
  style.textContent = `
    .status-success {
      background: var(--success-gradient) !important;
    }
    
    .status-loading {
      background: var(--warning-gradient) !important;
    }
    
    .status-error {
      background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%) !important;
    }
    
    .status-info {
      background: var(--primary-gradient) !important;
    }
  `;
  document.head.appendChild(style);
}