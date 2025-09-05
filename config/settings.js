module.exports = {
  // Browser settings
  browser: {
    headless: false, // Set to true for production
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },

  // Audit settings
  audit: {
    navigationTimeout: 30000,
    pageLoadDelay: 2000,
    popupDetectionDelay: 5000,
    maxProductPages: 3
  },

  // Screenshot settings
  screenshot: {
    fullPage: true,
    quality: 85
  },

  // Performance thresholds
  performance: {
    slowLoadTime: 3000, // ms
    maxImageCount: 50,
    maxScriptCount: 20
  },

  // Output settings
  output: {
    baseDir: './audits',
    includeRawData: true,
    generateHTML: true
  }
};