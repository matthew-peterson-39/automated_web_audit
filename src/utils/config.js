const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.defaultSettings = require('../../config/settings');
    this.websitesPath = path.join(__dirname, '../../config/websites.json');
  }

  loadWebsites() {
    try {
      if (fs.existsSync(this.websitesPath)) {
        const data = fs.readFileSync(this.websitesPath, 'utf8');
        const config = JSON.parse(data);
        return config.websites || [];
      } else {
        console.warn('⚠️  websites.json not found. Copy from websites.example.json and add your URLs.');
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading websites configuration:', error.message);
      return [];
    }
  }

  getSettings() {
    try {
      // Try to load custom settings if they exist
      const customSettingsPath = path.join(__dirname, '../../config/local.json');
      if (fs.existsSync(customSettingsPath)) {
        const customSettings = JSON.parse(fs.readFileSync(customSettingsPath, 'utf8'));
        return { ...this.defaultSettings, ...customSettings };
      }
      return this.defaultSettings;
    } catch (error) {
      console.warn('⚠️  Using default settings due to configuration error:', error.message);
      return this.defaultSettings;
    }
  }
}

module.exports = ConfigManager;