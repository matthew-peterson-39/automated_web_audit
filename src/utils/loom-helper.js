const fs = require('fs').promises;
const path = require('path');

class LoomHelper {
    constructor() {
        this.publicDir = './public';
        this.imagesDir = path.join(this.publicDir, 'images');
    }

    async prepareLoomAssets(auditResults = []) {
        try {
            console.log('🎬 Preparing Loom assistant assets...');
            
            // Create public directories
            await fs.mkdir(this.imagesDir, { recursive: true });
            
            // Copy Loom assistant HTML if it doesn't exist
            await this.ensureLoomAssistantExists();
            
            // Process each audit result
            for (const result of auditResults) {
                if (result.success !== false && result.pages) {
                    await this.processAuditForLoom(result);
                }
            }
            
            console.log('✅ Loom assets ready!');
            console.log(`📁 Open: ${path.resolve(this.publicDir, 'loom-assistant.html')}`);
            console.log(`📄 Load any audit_data_*.json file from the public folder`);
            
        } catch (error) {
            console.error('❌ Error preparing Loom assets:', error.message);
        }
    }

    async processAuditForLoom(auditData) {
        const siteName = auditData.siteName;
        const timestamp = new Date(auditData.timestamp).getTime();
        const uniqueId = `${siteName}_${timestamp}`;
        
        console.log(`📷 Processing images for ${siteName}...`);
        
        // Copy images and update paths
        if (auditData.pages) {
            for (const page of auditData.pages) {
                if (page.screenshot && await this.fileExists(page.screenshot)) {
                    const imageName = path.basename(page.screenshot);
                    const newImageName = `${uniqueId}_${imageName}`;
                    const destPath = path.join(this.imagesDir, newImageName);
                    
                    try {
                        // Copy image file
                        await fs.copyFile(page.screenshot, destPath);
                        
                        // Update path for web access
                        page.screenshot = `./images/${newImageName}`;
                        
                    } catch (error) {
                        console.log(`⚠️ Could not copy ${imageName}: ${error.message}`);
                        page.screenshot = null;
                    }
                }
            }
        }
        
        // Save web-ready JSON
        const publicJsonPath = path.join(this.publicDir, `audit_data_${uniqueId}.json`);
        await fs.writeFile(publicJsonPath, JSON.stringify(auditData, null, 2));
        
        console.log(`   ✅ Created: audit_data_${uniqueId}.json`);
    }

    async ensureLoomAssistantExists() {
        const loomHtmlPath = path.join(this.publicDir, 'loom-assistant.html');
        
        try {
            await fs.access(loomHtmlPath);
        } catch (error) {
            // File doesn't exist, create it
            console.log('📝 Creating Loom assistant HTML...');
            
            const loomHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loom Recording Assistant</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f7; color: #1d1d1f; line-height: 1.6; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .header h1 { color: #007AFF; margin-bottom: 10px; }
        .file-input { margin: 20px 0; padding: 20px; border: 2px dashed #007AFF; border-radius: 8px; text-align: center; background: #f8f9ff; }
        .file-input input { margin: 10px 0; }
        .main-content { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .script-panel { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); height: fit-content; position: sticky; top: 20px; }
        .script-section { margin-bottom: 25px; padding: 15px; border-left: 4px solid #007AFF; background: #f8f9ff; border-radius: 0 8px 8px 0; }
        .script-section h3 { color: #007AFF; margin-bottom: 10px; font-size: 16px; }
        .talking-point { background: white; padding: 10px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #34C759; cursor: pointer; transition: all 0.3s ease; }
        .talking-point:hover { background: #f0fff4; transform: translateX(5px); }
        .talking-point.completed { background: #e6f7e6; opacity: 0.7; text-decoration: line-through; }
        .image-gallery { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .image-container { margin-bottom: 20px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
        .image-header { background: #f8f9fa; padding: 10px 15px; font-weight: 600; color: #333; border-bottom: 1px solid #e0e0e0; }
        .image-content { position: relative; }
        .image-content img { width: 100%; height: auto; display: block; cursor: zoom-in; }
        .image-overlay { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric-card { background: white; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e0e0e0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007AFF; }
        .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
        .timer { position: fixed; top: 20px; right: 20px; background: #007AFF; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; z-index: 1000; }
        .controls { position: fixed; bottom: 20px; right: 20px; z-index: 1000; }
        .btn { background: #007AFF; color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer; font-weight: 600; margin: 0 5px; transition: all 0.3s ease; }
        .btn:hover { background: #0056CC; transform: translateY(-2px); }
        .btn.secondary { background: #8E8E93; }
        .performance-good { background: #d4edda; color: #155724; }
        .performance-warning { background: #fff3cd; color: #856404; }
        .performance-poor { background: #f8d7da; color: #721c24; }
        .popup-badge { display: inline-block; background: #FF9500; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 10px; }
        .no-popup-badge { display: inline-block; background: #8E8E93; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 10px; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2000; align-items: center; justify-content: center; }
        .modal.show { display: flex; }
        .modal img { max-width: 90%; max-height: 90%; border-radius: 8px; }
        .progress-bar { width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 20px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: #34C759; width: 0%; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎥 Loom Recording Assistant</h1>
            <p>Load your audit data to get automated talking points and visual cues for your outreach videos.</p>
            <div class="file-input">
                <p>📁 Load Audit Data</p>
                <input type="file" id="jsonFile" accept=".json" />
                <p style="font-size: 12px; color: #666; margin-top: 10px;">Select any audit_data_*.json file from this folder</p>
            </div>
            <div class="progress-bar"><div class="progress-fill" id="progressBar"></div></div>
        </div>
        <div id="mainContent" class="main-content" style="display: none;">
            <div class="script-panel">
                <h2>📝 Recording Script</h2>
                <div id="scriptContent"></div>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                    <h3>✅ Progress Tracker</h3>
                    <p id="progressText">0 of 0 points covered</p>
                </div>
            </div>
            <div class="image-gallery">
                <h2>🖼️ Visual Materials</h2>
                <div id="imageGallery"></div>
                <div id="metricsSection">
                    <h3>📊 Performance Snapshot</h3>
                    <div id="metricsGrid" class="metrics-grid"></div>
                </div>
            </div>
        </div>
    </div>
    <div class="timer" id="timer" style="display: none;">⏱️ <span id="timerDisplay">00:00</span></div>
    <div class="controls" id="controls" style="display: none;">
        <button class="btn" id="startTimer">▶️ Start Recording</button>
        <button class="btn secondary" id="resetTimer">🔄 Reset</button>
    </div>
    <div class="modal" id="imageModal"><img id="modalImage" src="" alt="Zoomed screenshot" /></div>
    <script>
        let auditData=null,startTime=null,timerInterval=null,completedPoints=0,totalPoints=0;
        document.getElementById('jsonFile').addEventListener('change',function(e){
            const file=e.target.files[0];
            if(file&&file.type==='application/json'){
                const reader=new FileReader();
                reader.onload=function(e){
                    try{auditData=JSON.parse(e.target.result);loadAuditData()}
                    catch(error){alert('Error reading JSON file: '+error.message)}
                };reader.readAsText(file)
            }
        });
        function loadAuditData(){
            if(!auditData)return;
            document.getElementById('mainContent').style.display='grid';
            document.getElementById('controls').style.display='block';
            generateScript();loadImages();loadMetrics();updateProgress()
        }
        function generateScript(){
            const script=document.getElementById('scriptContent');
            const siteName=auditData.siteName||'the website';
            const isShopify=auditData.isShopify;
            const hasPopup=auditData.popups?.hasPopup;
            const emailPlatform=auditData.popups?.emailPlatform;
            const loadTime=auditData.metrics?.performance?.loadTime;
            const issues=auditData.issues||[];
            let scriptHTML=\`
                <div class="script-section">
                    <h3>🎬 Opening (30 seconds)</h3>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Intro:</strong> "Hey [Name], I'm [Your Name] and I just ran a detailed audit on \${siteName}."</p>
                    </div>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Hook:</strong> "I found some quick wins that could boost your conversions - let me show you exactly what I mean."</p>
                    </div>
                </div>
                <div class="script-section">
                    <h3>👍 What's Working Well (30 seconds)</h3>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Platform:</strong> "First, what you're doing right - you're on \${isShopify?'Shopify, which is perfect for e-commerce':'a solid platform'}"</p>
                    </div>
                    \${hasPopup?\`<div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Email Strategy:</strong> "I can see you're already collecting emails\${emailPlatform?\` with \${emailPlatform}\`:''} - that's smart!"</p>
                    </div>\`:''}
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Visual:</strong> "Your site looks professional and the layout is clean - good foundation to work with."</p>
                    </div>
                </div>
                <div class="script-section">
                    <h3>🚀 Improvement Opportunities (60 seconds)</h3>
                    \${loadTime&&loadTime>3000?\`<div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Speed Issue:</strong> "Your page loads in \${(loadTime/1000).toFixed(1)} seconds - industry best practice is under 2 seconds. This is costing you customers."</p>
                    </div>\`:''}
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Mobile Comparison:</strong> "Let me show you the mobile vs desktop experience - there's a big difference here."</p>
                    </div>
                    \${!hasPopup?\`<div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Missing Email Capture:</strong> "You're missing out on 15-20% of visitors who would give you their email with the right popup strategy."</p>
                    </div>\`:''}
                    \${issues.some(i=>i.type==='SEO')?\`<div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>SEO Quick Wins:</strong> "I spotted some easy SEO improvements that could help you rank higher in Google."</p>
                    </div>\`:''}
                </div>
                <div class="script-section">
                    <h3>💰 Business Impact (30 seconds)</h3>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>ROI Focus:</strong> "These changes typically increase conversion rates by 15-25% - on a $10k month, that's $1,500-2,500 extra revenue."</p>
                    </div>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Timeline:</strong> "Most of these can be implemented in 1-2 weeks, so you'd see results quickly."</p>
                    </div>
                </div>
                <div class="script-section">
                    <h3>📞 Call to Action (30 seconds)</h3>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Next Steps:</strong> "I'd love to show you exactly how to implement these changes."</p>
                    </div>
                    <div class="talking-point" onclick="markCompleted(this)">
                        <p><strong>Close:</strong> "Are you free for a 15-minute call this week to go through the implementation plan?"</p>
                    </div>
                </div>\`;
            script.innerHTML=scriptHTML;
            totalPoints=document.querySelectorAll('.talking-point').length
        }
        function loadImages(){
            const gallery=document.getElementById('imageGallery');
            let imagesHTML='';
            if(auditData.pages&&auditData.pages.length>0){
                auditData.pages.forEach(page=>{
                    if(page.screenshot){
                        const displayName=page.name.replace(/_/g,' ').toUpperCase();
                        imagesHTML+=\`<div class="image-container">
                            <div class="image-header">
                                \${displayName} - \${page.title||'No title'}
                                \${page.name.includes('mobile')?'<span class="popup-badge">📱 MOBILE</span>':''}
                                \${page.name.includes('desktop')?'<span class="no-popup-badge">🖥️ DESKTOP</span>':''}
                            </div>
                            <div class="image-content">
                                <img src="\${page.screenshot}" alt="\${page.name}" onclick="showFullImage('\${page.screenshot}')">
                                <div class="image-overlay">Click to zoom</div>
                            </div>
                        </div>\`
                    }
                })
            }
            gallery.innerHTML=imagesHTML
        }
        function loadMetrics(){
            const grid=document.getElementById('metricsGrid');
            const performance=auditData.metrics?.performance||{};
            const loadTime=performance.loadTime||0;
            const imageCount=performance.imageCount||0;
            const issueCount=auditData.issues?.length||0;
            const hasPopup=auditData.popups?.hasPopup?'Yes':'No';
            const platform=auditData.popups?.emailPlatform||'None';
            function getPerformanceClass(value,good,warning){
                if(value<=good)return'performance-good';
                if(value<=warning)return'performance-warning';
                return'performance-poor'
            }
            const loadTimeClass=getPerformanceClass(loadTime,2000,3000);
            grid.innerHTML=\`<div class="metric-card"><div class="metric-value \${loadTimeClass}">\${(loadTime/1000).toFixed(1)}s</div><div class="metric-label">Load Time</div></div>
                <div class="metric-card"><div class="metric-value">\${imageCount}</div><div class="metric-label">Images</div></div>
                <div class="metric-card"><div class="metric-value \${issueCount>5?'performance-poor':issueCount>2?'performance-warning':'performance-good'}">\${issueCount}</div><div class="metric-label">Issues Found</div></div>
                <div class="metric-card"><div class="metric-value">\${hasPopup}</div><div class="metric-label">Popup</div></div>
                <div class="metric-card"><div class="metric-value">\${platform}</div><div class="metric-label">Email Platform</div></div>
                <div class="metric-card"><div class="metric-value">\${auditData.classification==='popup_detected'?'📧':'📭'}</div><div class="metric-label">Category</div></div>\`
        }
        function markCompleted(element){
            if(!element.classList.contains('completed')){element.classList.add('completed');completedPoints++}
            else{element.classList.remove('completed');completedPoints--}
            updateProgress()
        }
        function updateProgress(){
            const progress=totalPoints>0?(completedPoints/totalPoints)*100:0;
            document.getElementById('progressBar').style.width=progress+'%';
            document.getElementById('progressText').textContent=\`\${completedPoints} of \${totalPoints} points covered\`
        }
        function showFullImage(src){
            document.getElementById('modalImage').src=src;
            document.getElementById('imageModal').classList.add('show')
        }
        document.getElementById('imageModal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('show')});
        document.getElementById('startTimer').addEventListener('click',function(){
            if(!startTime){
                startTime=Date.now();
                document.getElementById('timer').style.display='block';
                this.textContent='⏸️ Recording...';this.style.background='#FF3B30';
                timerInterval=setInterval(updateTimer,1000)
            }else stopTimer()
        });
        document.getElementById('resetTimer').addEventListener('click',function(){stopTimer();resetTimer()});
        function updateTimer(){
            if(startTime){
                const elapsed=Date.now()-startTime;
                const minutes=Math.floor(elapsed/60000);
                const seconds=Math.floor((elapsed%60000)/1000);
                document.getElementById('timerDisplay').textContent=\`\${minutes.toString().padStart(2,'0')}:\${seconds.toString().padStart(2,'0')}\`
            }
        }
        function stopTimer(){
            if(timerInterval){clearInterval(timerInterval);timerInterval=null}
            document.getElementById('startTimer').textContent='▶️ Start Recording';
            document.getElementById('startTimer').style.background='#007AFF'
        }
        function resetTimer(){startTime=null;document.getElementById('timer').style.display='none';document.getElementById('timerDisplay').textContent='00:00'}
        document.addEventListener('keydown',function(e){
            if(e.key===' '&&e.ctrlKey){e.preventDefault();document.getElementById('startTimer').click()}
            if(e.key==='r'&&e.ctrlKey){e.preventDefault();document.getElementById('resetTimer').click()}
        })
    </script>
</body>
</html>`;
            
            await fs.writeFile(loomHtmlPath, loomHtml);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = { LoomHelper };