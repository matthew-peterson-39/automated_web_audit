# 🔍 Automated Website Auditor

A powerful Node.js tool that automatically audits websites for SEO, performance, accessibility, and e-commerce optimization. Perfect for freelancers, agencies, and developers who need to quickly assess websites and generate professional audit reports.

## ✨ Features

- **Automated Screenshot Capture** - Full-page screenshots of homepage, product pages, and mobile views
- **SEO Analysis** - Meta tags, H1 structure, HTTPS usage detection
- **Performance Metrics** - Load times, resource counts, optimization opportunities  
- **Accessibility Checks** - Alt text validation, semantic structure analysis
- **E-commerce Detection** - Shopify and platform identification, product page analysis
- **Professional Reports** - Clean HTML reports with visual metrics and actionable insights
- **Batch Processing** - Audit multiple websites automatically
- **Mobile Testing** - Responsive design validation

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- Chrome/Chromium browser

### Installation

```bash
git clone https://github.com/matthew-peterson-39/automated_web_audit.git
cd automated-web-auditor
npm install
```

### Configuration

1. Copy the example configuration:
```bash
cp config/websites.example.json config/websites.json
```

2. Add your target websites to `config/websites.json`:
```json
{
  "websites": [
    "https://example.com",
    "https://yourstore.com"
  ]
}
```

### Usage

Run a full audit:
```bash
npm start
```

Or run directly:
```bash
node src/index.js
```

### Output

Results are saved to the `audits/` directory with:
- Screenshots of all captured pages
- `audit_report.html` - Visual report
- `audit_data.json` - Raw audit data

## 📁 Project Structure

```
automated-website-auditor/
├── src/
│   ├── index.js              # Main entry point
│   ├── auditor.js           # Core audit logic
│   └── utils/
│       ├── detector.js      # Platform/feature detection
│       └── reporter.js      # Report generation
├── config/
│   ├── websites.example.json # Example configuration
│   └── settings.js          # Default settings
├── audits/                  # Generated audit reports (gitignored)
└── README.md
```

## ⚙️ Configuration Options

Edit `config/settings.js` to customize:

- Screenshot quality and dimensions
- Audit timeout settings  
- Report styling and branding
- Performance thresholds

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Puppeteer](https://github.com/puppeteer/puppeteer)
- Inspired by the need for automated website analysis tools

---

**⭐ Star this repo if it helps with your website audits!**