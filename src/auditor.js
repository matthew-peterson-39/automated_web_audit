const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class WebsiteAuditor {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({ 
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
        });
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid bot detection
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set a reasonable timeout
        this.page.setDefaultNavigationTimeout(30000);
        this.page.setDefaultTimeout(30000);
    }

    async auditWebsite(url) {
        console.log(`\n📊 Starting audit for: ${url}`);
        
        try {
            // Create output directory
            const siteName = new URL(url).hostname.replace(/\./g, '_');
            const outputDir = `./audits/${siteName}_${Date.now()}`;
            await fs.mkdir(outputDir, { recursive: true });

            const auditData = {
                url,
                siteName,
                timestamp: new Date().toISOString(),
                pages: [],
                metrics: {},
                issues: []
            };

            // Navigate to main page
            console.log('🏠 Capturing homepage...');
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Check if it's a Shopify store
            const isShopify = await this.detectShopify();
            auditData.isShopify = isShopify;
            
            // Capture homepage
            const homepageData = await this.capturePage('homepage', outputDir);
            auditData.pages.push(homepageData);

            // Get performance metrics
            const performanceMetrics = await this.getPerformanceMetrics();
            auditData.metrics.performance = performanceMetrics;

            // Find and capture product pages (for e-commerce)
            if (isShopify || await this.detectEcommerce()) {
                console.log('🛍️ E-commerce detected, finding product pages...');
                const productLinks = await this.findProductPages();
                
                // Capture up to 3 product pages
                for (let i = 0; i < Math.min(3, productLinks.length); i++) {
                    const productUrl = productLinks[i];
                    console.log(`📦 Capturing product page: ${productUrl}`);
                    
                    await this.page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    const productData = await this.capturePage(`product_${i + 1}`, outputDir);
                    auditData.pages.push(productData);
                }
            }

            // Capture mobile view of homepage
            console.log('📱 Capturing mobile view...');
            await this.page.setViewport({ width: 375, height: 667 });
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            const mobileData = await this.capturePage('mobile_homepage', outputDir);
            auditData.pages.push(mobileData);

            // Run automated checks
            auditData.issues = await this.runAutomatedChecks();

            // Generate audit report
            await this.generateReport(auditData, outputDir);

            console.log(`✅ Audit complete! Results saved to: ${outputDir}`);
            return auditData;

        } catch (error) {
            console.error('❌ Error during audit:', error.message);
            throw error;
        }
    }

    async detectShopify() {
        try {
            // Check for Shopify indicators
            const shopifyIndicators = await this.page.evaluate(() => {
                return {
                    hasShopifyScript: !!document.querySelector('script[src*="shopify"]'),
                    hasShopifyMeta: !!document.querySelector('meta[name="generator"][content*="Shopify"]'),
                    hasShopifyGlobal: typeof window.Shopify !== 'undefined',
                    hasShopifyTheme: !!document.querySelector('link[href*="shopify"]')
                };
            });
            
            return Object.values(shopifyIndicators).some(indicator => indicator);
        } catch (error) {
            return false;
        }
    }

    async detectEcommerce() {
        try {
            const ecommerceIndicators = await this.page.evaluate(() => {
                const text = document.body.textContent.toLowerCase();
                const hasAddToCart = text.includes('add to cart') || document.querySelector('[class*="add-to-cart"], [id*="add-to-cart"]');
                const hasPrice = document.querySelector('[class*="price"], [id*="price"]') || /\$\d+/.test(text);
                const hasProduct = text.includes('product') || text.includes('shop');
                
                return hasAddToCart || (hasPrice && hasProduct);
            });
            
            return ecommerceIndicators;
        } catch (error) {
            return false;
        }
    }

    async findProductPages() {
        try {
            const productLinks = await this.page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                return links
                    .map(link => link.href)
                    .filter(href => {
                        const url = href.toLowerCase();
                        return (
                            url.includes('/products/') ||
                            url.includes('/product/') ||
                            url.includes('/shop/') ||
                            url.includes('/store/')
                        ) && !url.includes('#') && href.startsWith('http');
                    })
                    .slice(0, 5); // Limit to 5 potential product pages
            });
            
            return [...new Set(productLinks)]; // Remove duplicates
        } catch (error) {
            return [];
        }
    }

    async capturePage(pageName, outputDir) {
        const screenshotPath = path.join(outputDir, `${pageName}.png`);
        
        // Wait for page to be fully loaded using standard setTimeout
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take full page screenshot
        await this.page.screenshot({ 
            path: screenshotPath, 
            fullPage: true 
        });

        // Get page info
        const pageInfo = await this.page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                description: document.querySelector('meta[name="description"]')?.content || '',
                h1: document.querySelector('h1')?.textContent || '',
                loadTime: performance.now()
            };
        });

        return {
            name: pageName,
            screenshot: screenshotPath,
            ...pageInfo
        };
    }

    async getPerformanceMetrics() {
        try {
            const metrics = await this.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                return {
                    loadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
                    domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
                    firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
                    imageCount: document.images.length,
                    linkCount: document.links.length,
                    scriptCount: document.scripts.length
                };
            });
            return metrics;
        } catch (error) {
            return {};
        }
    }

    async runAutomatedChecks() {
        const issues = [];

        try {
            // Check for missing meta description
            const hasMetaDescription = await this.page.$('meta[name="description"]');
            if (!hasMetaDescription) {
                issues.push({ type: 'SEO', issue: 'Missing meta description' });
            }

            // Check for missing alt tags
            const imagesWithoutAlt = await this.page.$$eval('img:not([alt])', imgs => imgs.length);
            if (imagesWithoutAlt > 0) {
                issues.push({ type: 'Accessibility', issue: `${imagesWithoutAlt} images missing alt text` });
            }

            // Check for h1 tag
            const h1Count = await this.page.$$eval('h1', h1s => h1s.length);
            if (h1Count === 0) {
                issues.push({ type: 'SEO', issue: 'No H1 tag found' });
            } else if (h1Count > 1) {
                issues.push({ type: 'SEO', issue: 'Multiple H1 tags found' });
            }

            // Check for HTTPS
            const isHTTPS = await this.page.evaluate(() => location.protocol === 'https:');
            if (!isHTTPS) {
                issues.push({ type: 'Security', issue: 'Site not using HTTPS' });
            }

            // Check page load time
            const loadTime = await this.page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                return navigation.loadEventEnd - navigation.fetchStart;
            });
            
            if (loadTime > 3000) {
                issues.push({ type: 'Performance', issue: `Slow page load time: ${Math.round(loadTime)}ms` });
            }

        } catch (error) {
            issues.push({ type: 'Error', issue: `Could not complete all checks: ${error.message}` });
        }

        return issues;
    }

    async generateReport(auditData, outputDir) {
        const reportPath = path.join(outputDir, 'audit_report.html');
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Website Audit Report - ${auditData.siteName}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .screenshot { max-width: 100%; border: 1px solid #ddd; margin: 10px 0; }
        .issue { background: #fff3cd; padding: 10px; margin: 5px 0; border-left: 4px solid #ffc107; }
        .issue.SEO { border-left-color: #007bff; background: #d1ecf1; }
        .issue.Performance { border-left-color: #dc3545; background: #f8d7da; }
        .issue.Security { border-left-color: #fd7e14; background: #ffeaa7; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Website Audit Report</h1>
        <p><strong>Site:</strong> ${auditData.url}</p>
        <p><strong>Generated:</strong> ${new Date(auditData.timestamp).toLocaleString()}</p>
        <p><strong>Platform:</strong> ${auditData.isShopify ? 'Shopify' : 'Unknown/Custom'}</p>
    </div>

    <div class="section">
        <h2>Performance Metrics</h2>
        <div class="metrics">
            <div class="metric">
                <h3>${auditData.metrics.performance?.loadTime || 'N/A'}ms</h3>
                <p>Page Load Time</p>
            </div>
            <div class="metric">
                <h3>${auditData.metrics.performance?.imageCount || 0}</h3>
                <p>Images</p>
            </div>
            <div class="metric">
                <h3>${auditData.pages.length}</h3>
                <p>Pages Captured</p>
            </div>
            <div class="metric">
                <h3>${auditData.issues.length}</h3>
                <p>Issues Found</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Issues Found</h2>
        ${auditData.issues.map(issue => `
            <div class="issue ${issue.type}">
                <strong>${issue.type}:</strong> ${issue.issue}
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Screenshots</h2>
        ${auditData.pages.map(page => `
            <div>
                <h3>${page.name} - ${page.title}</h3>
                <img src="${path.basename(page.screenshot)}" alt="${page.name}" class="screenshot">
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        await fs.writeFile(reportPath, html);
        
        // Also create a JSON report for programmatic use
        const jsonPath = path.join(outputDir, 'audit_data.json');
        await fs.writeFile(jsonPath, JSON.stringify(auditData, null, 2));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Main execution function
async function runAudit() {
    const websites = [
        'https://o2trainer.com', // Your Shopify store
        // Add more URLs as needed
    ];

    const auditor = new WebsiteAuditor();
    
    try {
        await auditor.initialize();
        
        for (const url of websites) {
            await auditor.auditWebsite(url);
            // Add delay between audits to be respectful
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await auditor.close();
    }
}

// Export for use as a module
module.exports = { WebsiteAuditor, runAudit };

// Run if called directly
if (require.main === module) {
    runAudit();
}