const fs = require('fs').promises;
const path = require('path');

class WebsiteAuditor {
    constructor(settings = {}) {
        this.browser = null;
        this.page = null;
        this.settings = settings;
        this.defaultViewport = { width: 1920, height: 1080 };
        this.mobileViewport = { width: 375, height: 667 };
    }

    async initialize() {
        console.log('🚀 Launching browser...');
        const puppeteer = require('puppeteer');
        
        const browserSettings = this.settings.browser || {
            headless: false,
            defaultViewport: this.defaultViewport,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        };

        this.browser = await puppeteer.launch(browserSettings);
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid bot detection
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set timeouts
        const timeout = this.settings.audit?.navigationTimeout || 30000;
        this.page.setDefaultNavigationTimeout(timeout);
        this.page.setDefaultTimeout(timeout);
    }

    async auditWebsite(url) {
        console.log(`\n📊 Starting audit for: ${url}`);
        
        try {
            // Reset to desktop viewport at start of each audit
            await this.page.setViewport(this.defaultViewport);
            
            // Create temporary output directory
            const siteName = new URL(url).hostname.replace(/\./g, '_');
            const timestamp = Date.now();
            const tempOutputDir = `./audits/temp_${siteName}_${timestamp}`;
            await fs.mkdir(tempOutputDir, { recursive: true });

            const auditData = {
                url,
                siteName,
                timestamp: new Date().toISOString(),
                pages: [],
                metrics: {},
                issues: [],
                popups: null,
                classification: null
            };

            // Navigate to main page
            console.log('🏠 Capturing homepage...');
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Check if it's a Shopify store
            const isShopify = await this.detectShopify();
            auditData.isShopify = isShopify;

            // Detect popups and email platforms FIRST (before any other captures)
            console.log('🔍 Checking for popups and email platforms...');
            const popupData = await this.detectPopupsAndEmailPlatforms();
            auditData.popups = popupData;

            // Determine classification and create final output directory
            const popupFolder = popupData.hasPopup ? 'popup_detected' : 'no_popup';
            const finalOutputDir = `./audits/${popupFolder}/${siteName}_${timestamp}`;
            await fs.mkdir(finalOutputDir, { recursive: true });
            auditData.classification = popupFolder;
            auditData.outputDirectory = finalOutputDir;

            // Capture homepage (desktop view)
            console.log('🖥️ Capturing desktop homepage...');
            const homepageData = await this.capturePage('homepage_desktop', finalOutputDir);
            auditData.pages.push(homepageData);

            // Get performance metrics
            const performanceMetrics = await this.getPerformanceMetrics();
            auditData.metrics.performance = performanceMetrics;

            // Find and capture product pages (for e-commerce)
            if (isShopify || await this.detectEcommerce()) {
                console.log('🛍️ E-commerce detected, finding product pages...');
                const productLinks = await this.findProductPages();
                
                // Capture up to 3 product pages (desktop)
                for (let i = 0; i < Math.min(3, productLinks.length); i++) {
                    const productUrl = productLinks[i];
                    console.log(`📦 Capturing product page: ${productUrl}`);
                    
                    await this.page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                    const productData = await this.capturePage(`product_${i + 1}_desktop`, finalOutputDir);
                    auditData.pages.push(productData);
                }
            }

            // Switch to mobile view and capture
            console.log('📱 Switching to mobile view...');
            await this.page.setViewport(this.mobileViewport);
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            const mobileData = await this.capturePage('homepage_mobile', finalOutputDir);
            auditData.pages.push(mobileData);

            // Reset to desktop view for next audit
            console.log('🖥️ Resetting to desktop view...');
            await this.page.setViewport(this.defaultViewport);

            // Run automated checks
            auditData.issues = await this.runAutomatedChecks();

            // Generate audit report
            await this.generateReport(auditData, finalOutputDir);

            // Clean up temp directory
            try {
                await fs.rmdir(tempOutputDir);
            } catch (error) {
                // Temp directory might not exist or be empty, that's fine
            }

            console.log(`✅ Audit complete! Results saved to: ${finalOutputDir}`);
            if (popupData.hasPopup) {
                console.log(`📧 Popup detected: ${popupData.popupType} (Platform: ${popupData.emailPlatform || 'Unknown'})`);
            }
            
            return auditData;

        } catch (error) {
            console.error('❌ Error during audit:', error.message);
            
            // Try to clean up temp directory if it exists
            try {
                await fs.rmdir(tempOutputDir).catch(() => {});
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            // Return error info instead of throwing (so other audits can continue)
            return {
                url,
                siteName,
                timestamp: new Date().toISOString(),
                error: error.message,
                success: false
            };
        }
    }

    async detectPopupsAndEmailPlatforms() {
        const popupData = {
            hasPopup: false,
            popupType: null,
            emailPlatform: null,
            popupDetails: [],
            emailPlatformDetails: []
        };

        try {
            // Wait a bit for popups to potentially appear
            const popupDelay = this.settings.audit?.popupDetectionDelay || 5000;
            await new Promise(resolve => setTimeout(resolve, popupDelay));

            // Detect email platforms first (they often load before popups)
            const emailPlatforms = await this.page.evaluate(() => {
                const platforms = [];
                
                // Klaviyo detection
                if (window.klaviyo || window._learnq || document.querySelector('script[src*="klaviyo"]')) {
                    platforms.push('Klaviyo');
                }
                
                // Mailchimp detection
                if (window.mc4wp || document.querySelector('script[src*="mailchimp"]') || 
                    document.querySelector('[class*="mailchimp"], [id*="mailchimp"]')) {
                    platforms.push('Mailchimp');
                }
                
                // Omnisend detection
                if (window.omnisend || document.querySelector('script[src*="omnisend"]')) {
                    platforms.push('Omnisend');
                }
                
                // Privy detection
                if (window.privy || document.querySelector('script[src*="privy"]')) {
                    platforms.push('Privy');
                }
                
                // Justuno detection
                if (window.ju || document.querySelector('script[src*="justuno"]')) {
                    platforms.push('Justuno');
                }
                
                // OptinMonster detection
                if (window.om || document.querySelector('script[src*="optinmonster"]')) {
                    platforms.push('OptinMonster');
                }
                
                // Wisepops detection
                if (window.wisepops || document.querySelector('script[src*="wisepops"]')) {
                    platforms.push('Wisepops');
                }
                
                // Sumo detection
                if (window.sumo || document.querySelector('script[src*="sumo.com"]')) {
                    platforms.push('Sumo');
                }
                
                return platforms;
            });

            popupData.emailPlatformDetails = emailPlatforms;
            popupData.emailPlatform = emailPlatforms.length > 0 ? emailPlatforms[0] : null;

            // Detect popups/modals
            const popupElements = await this.page.evaluate(() => {
                const popups = [];
                
                // Common popup/modal selectors
                const popupSelectors = [
                    '[class*="popup"]',
                    '[class*="modal"]',
                    '[class*="overlay"]',
                    '[class*="lightbox"]',
                    '[id*="popup"]',
                    '[id*="modal"]',
                    '[class*="newsletter"]',
                    '[class*="email-signup"]',
                    '[class*="subscription"]',
                    '[data-testid*="popup"]',
                    '[data-testid*="modal"]',
                    // Klaviyo specific
                    '.klaviyo-form',
                    '[class*="klaviyo"]',
                    // Privy specific
                    '.privy-popup',
                    // Common exit intent/overlay patterns
                    '[style*="position: fixed"]',
                    '[style*="z-index: 999"]',
                    '[style*="z-index: 9999"]'
                ];
                
                popupSelectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            const rect = element.getBoundingClientRect();
                            const isVisible = rect.width > 0 && rect.height > 0 && 
                                            window.getComputedStyle(element).display !== 'none' &&
                                            window.getComputedStyle(element).visibility !== 'hidden';
                            
                            const hasEmailInput = element.querySelector('input[type="email"]');
                            const text = element.textContent || '';
                            const hasSubscribeText = text.toLowerCase().includes('subscribe') ||
                                                   text.toLowerCase().includes('newsletter') ||
                                                   text.toLowerCase().includes('email') ||
                                                   text.toLowerCase().includes('discount') ||
                                                   text.toLowerCase().includes('offer') ||
                                                   text.toLowerCase().includes('save');
                            
                            if (isVisible && (hasEmailInput || hasSubscribeText) && text.length > 10) {
                                popups.push({
                                    selector: selector,
                                    hasEmailInput: !!hasEmailInput,
                                    text: text.substring(0, 200),
                                    classes: element.className,
                                    id: element.id,
                                    width: Math.round(rect.width),
                                    height: Math.round(rect.height)
                                });
                            }
                        });
                    } catch (error) {
                        // Continue with other selectors if one fails
                    }
                });
                
                return popups;
            });

            if (popupElements.length > 0) {
                popupData.hasPopup = true;
                popupData.popupDetails = popupElements;
                
                // Classify popup type
                const hasEmailInput = popupElements.some(p => p.hasEmailInput);
                const hasDiscountText = popupElements.some(p => {
                    const text = p.text.toLowerCase();
                    return text.includes('discount') || 
                           text.includes('save') ||
                           text.includes('%') ||
                           text.includes('off');
                });
                
                if (hasEmailInput && hasDiscountText) {
                    popupData.popupType = 'Email + Discount';
                } else if (hasEmailInput) {
                    popupData.popupType = 'Email Signup';
                } else if (hasDiscountText) {
                    popupData.popupType = 'Discount Offer';
                } else {
                    popupData.popupType = 'General Popup';
                }
            }

        } catch (error) {
            console.log('⚠️ Error during popup detection:', error.message);
        }

        return popupData;
    }

    async detectShopify() {
        try {
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
            const maxPages = this.settings.audit?.maxProductPages || 3;
            const productLinks = await this.page.evaluate((maxPages) => {
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
                    .slice(0, maxPages * 2); // Get extra in case some fail to load
            }, maxPages);
            
            return [...new Set(productLinks)]; // Remove duplicates
        } catch (error) {
            return [];
        }
    }

    async capturePage(pageName, outputDir) {
        const screenshotPath = path.join(outputDir, `${pageName}.png`);
        
        // Wait for page to be fully loaded
        const pageLoadDelay = this.settings.audit?.pageLoadDelay || 2000;
        await new Promise(resolve => setTimeout(resolve, pageLoadDelay));
        
        // Take full page screenshot
        const screenshotSettings = this.settings.screenshot || { fullPage: true };
        await this.page.screenshot({ 
            path: screenshotPath, 
            ...screenshotSettings
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
            
            const slowThreshold = this.settings.performance?.slowLoadTime || 3000;
            if (loadTime > slowThreshold) {
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
        .popup-info { background: #e7f3ff; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .popup-detail { background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Website Audit Report</h1>
        <p><strong>Site:</strong> ${auditData.url}</p>
        <p><strong>Generated:</strong> ${new Date(auditData.timestamp).toLocaleString()}</p>
        <p><strong>Platform:</strong> ${auditData.isShopify ? 'Shopify' : 'Unknown/Custom'}</p>
        <p><strong>Classification:</strong> ${auditData.classification || 'Unknown'}</p>
        ${auditData.popups ? `
        <p><strong>Popup Detected:</strong> ${auditData.popups.hasPopup ? `Yes (${auditData.popups.popupType})` : 'No'}</p>
        ${auditData.popups.emailPlatform ? `<p><strong>Email Platform:</strong> ${auditData.popups.emailPlatform}</p>` : ''}
        ` : ''}
    </div>

    ${auditData.popups && auditData.popups.hasPopup ? `
    <div class="section">
        <h2>Popup Analysis</h2>
        <div class="popup-info">
            <p><strong>Type:</strong> ${auditData.popups.popupType}</p>
            <p><strong>Email Platform:</strong> ${auditData.popups.emailPlatform || 'Unknown'}</p>
            ${auditData.popups.emailPlatformDetails.length > 1 ? `<p><strong>Additional Platforms:</strong> ${auditData.popups.emailPlatformDetails.slice(1).join(', ')}</p>` : ''}
            <div class="popup-details">
                <h3>Popup Details:</h3>
                ${auditData.popups.popupDetails.map(popup => `
                    <div class="popup-detail">
                        <p><strong>Email Input:</strong> ${popup.hasEmailInput ? 'Yes' : 'No'}</p>
                        <p><strong>Size:</strong> ${popup.width}x${popup.height}px</p>
                        <p><strong>Preview:</strong> ${popup.text.substring(0, 100)}...</p>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    ` : ''}

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
            <div class="metric">
                <h3>${auditData.popups ? (auditData.popups.hasPopup ? 'Yes' : 'No') : 'Unknown'}</h3>
                <p>Popup Detected</p>
            </div>
            <div class="metric">
                <h3>${auditData.popups?.emailPlatform || 'None'}</h3>
                <p>Email Platform</p>
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
                <h3>${page.name.replace(/_/g, ' ').toUpperCase()} - ${page.title}</h3>
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

module.exports = { WebsiteAuditor };