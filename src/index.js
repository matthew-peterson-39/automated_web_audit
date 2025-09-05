const { WebsiteAuditor } = require('./auditor');
const ConfigManager = require('./utils/config');

async function main() {
  console.log('🔍 Automated Website Auditor');
  console.log('=============================\n');

  const configManager = new ConfigManager();
  const websites = configManager.loadWebsites();
  const settings = configManager.getSettings();

  if (websites.length === 0) {
    console.log('❌ No websites found to audit.');
    console.log('📝 Please create config/websites.json from the example file and add your URLs.');
    process.exit(1);
  }

  console.log(`📊 Found ${websites.length} website(s) to audit:`);
  websites.forEach((url, index) => {
    console.log(`   ${index + 1}. ${url}`);
  });
  console.log('');

  const auditor = new WebsiteAuditor(settings);
  
  try {
    await auditor.initialize();
    
    for (const url of websites) {
      await auditor.auditWebsite(url);
      
      // Add delay between audits to be respectful
      if (settings.audit.delayBetweenAudits > 0) {
        await new Promise(resolve => 
          setTimeout(resolve, settings.audit.delayBetweenAudits)
        );
      }
    }
    
    console.log('\n✅ All audits completed successfully!');
    console.log('📁 Check the ./audits/ directory for results.');
    
  } catch (error) {
    console.error('❌ Audit process failed:', error.message);
    process.exit(1);
  } finally {
    await auditor.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Audit interrupted by user');
  process.exit(0);
});

// Run the auditor
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main };