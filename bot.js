(function() {
    'use strict';
    
    // Bot detection scoring system
    let botScore = 0;
    let maxScore = 0;
    const detectionResults = {};
    
    // Weighted scoring system - adjust these weights as needed
    const weights = {
        userAgent: 15,
        navigator: 20,
        headless: 25,
        webdriver: 30,
        canvas: 15,
        webgl: 10,
        fonts: 8,
        audio: 12,
        mouse: 20,
        keyboard: 15,
        scroll: 10,
        focus: 8,
        timing: 18,
        network: 12,
        traps: 25,
        advanced: 22
    };

    // 1. USER AGENT ANALYSIS
    function analyzeUserAgent() {
        const ua = navigator.userAgent;
        let suspiciousPoints = 0;
        
        // Common bot user agents patterns
        const botPatterns = [
            /bot/i, /crawl/i, /spider/i, /scrape/i,
            /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
            /chrome-lighthouse/i, /node/i, /python/i, /curl/i
        ];
        
        // Suspicious characteristics
        if (botPatterns.some(pattern => pattern.test(ua))) suspiciousPoints += 0.8;
        if (ua.length < 50 || ua.length > 500) suspiciousPoints += 0.3;
        if (!ua.includes('Mozilla')) suspiciousPoints += 0.4;
        if (ua.includes('HeadlessChrome')) suspiciousPoints += 1.0;
        
        detectionResults.userAgent = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 2. NAVIGATOR PROPERTIES CHECK
    function checkNavigatorProperties() {
        let suspiciousPoints = 0;
        
        // Check for missing or unusual navigator properties
        if (typeof navigator.webdriver !== 'undefined') suspiciousPoints += 0.9;
        if (!navigator.languages || navigator.languages.length === 0) suspiciousPoints += 0.5;
        if (navigator.plugins.length === 0) suspiciousPoints += 0.4;
        if (!navigator.cookieEnabled) suspiciousPoints += 0.3;
        if (navigator.hardwareConcurrency === 0) suspiciousPoints += 0.6;
        if (!navigator.platform) suspiciousPoints += 0.4;
        if (navigator.maxTouchPoints === 0 && /mobile/i.test(navigator.userAgent)) suspiciousPoints += 0.5;
        
        // Check for automation indicators
        if (window.navigator.webdriver) suspiciousPoints += 1.0;
        if (window.callPhantom || window._phantom) suspiciousPoints += 1.0;
        
        detectionResults.navigator = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 3. HEADLESS BROWSER DETECTION
    function detectHeadless() {
        let suspiciousPoints = 0;
        
        // Chrome headless detection
        if (window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect === undefined) {
            suspiciousPoints += 0.8;
        }
        
        // Check for missing window properties typical in headless
        if (!window.outerWidth || !window.outerHeight) suspiciousPoints += 0.6;
        if (screen.width === 0 || screen.height === 0) suspiciousPoints += 0.8;
        if (screen.colorDepth === 0) suspiciousPoints += 0.7;
        
        // Puppeteer detection
        if (navigator.permissions && navigator.permissions.query) {
            // This is async, but we'll check synchronously available indicators
            if (window.chrome && !window.chrome.app) suspiciousPoints += 0.3;
        }
        
        detectionResults.headless = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 4. WEBDRIVER DETECTION
    function detectWebDriver() {
        let suspiciousPoints = 0;
        
        // Direct webdriver detection
        if (navigator.webdriver === true) suspiciousPoints += 1.0;
        if (window.document.documentElement.getAttribute('webdriver')) suspiciousPoints += 1.0;
        if (window.document.documentElement.getAttribute('selenium')) suspiciousPoints += 1.0;
        if (window.document.documentElement.getAttribute('driver')) suspiciousPoints += 1.0;
        
        // Selenium detection
        if (window.document.getElementsByTagName('html')[0].getAttribute('webdriver')) suspiciousPoints += 1.0;
        if (typeof window.__webdriverActive !== 'undefined') suspiciousPoints += 1.0;
        if (typeof window.__selenium_unwrapped !== 'undefined') suspiciousPoints += 1.0;
        if (typeof window._Selenium_IDE_Recorder !== 'undefined') suspiciousPoints += 1.0;
        
        detectionResults.webdriver = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 5. CANVAS FINGERPRINTING
    function canvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let suspiciousPoints = 0;
            
            // Draw complex pattern
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Bot Detection Test 🤖', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Canvas fingerprinting', 4, 17);
            
            const dataURL = canvas.toDataURL();
            
            // Check for suspicious canvas behavior
            if (!dataURL || dataURL === 'data:,') suspiciousPoints += 0.9;
            if (dataURL.length < 100) suspiciousPoints += 0.8;
            
            // Known bot canvas signatures (simplified)
            const knownBotHashes = [
                'e3b0c44298fc1c149afbf4c8996fb924',  // Empty canvas hash example
                'd41d8cd98f00b204e9800998ecf8427e'   // Another common bot signature
            ];
            
            // Simple hash check (in real implementation, use proper hashing)
            if (dataURL.includes('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA')) {
                if (dataURL.length < 200) suspiciousPoints += 0.6;
            }
            
            detectionResults.canvas = suspiciousPoints;
            return Math.min(suspiciousPoints, 1);
        } catch (e) {
            detectionResults.canvas = 0.7; // Canvas blocked/error is suspicious
            return 0.7;
        }
    }

    // 6. WEBGL FINGERPRINTING
    function webglFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            let suspiciousPoints = 0;
            
            if (!gl) {
                suspiciousPoints += 0.6; // No WebGL support is somewhat suspicious
            } else {
                const renderer = gl.getParameter(gl.RENDERER);
                const vendor = gl.getParameter(gl.VENDOR);
                
                // Check for software rendering (common in bots)
                if (renderer && renderer.includes('SwiftShader')) suspiciousPoints += 0.8;
                if (renderer && renderer.includes('llvmpipe')) suspiciousPoints += 0.8;
                if (vendor && vendor.includes('Google Inc.') && renderer && renderer.includes('ANGLE')) {
                    // Common in headless Chrome
                    suspiciousPoints += 0.4;
                }
                
                // Check for missing WebGL extensions (bots often have fewer)
                const extensions = gl.getSupportedExtensions();
                if (!extensions || extensions.length < 10) suspiciousPoints += 0.5;
            }
            
            detectionResults.webgl = suspiciousPoints;
            return Math.min(suspiciousPoints, 1);
        } catch (e) {
            detectionResults.webgl = 0.5;
            return 0.5;
        }
    }

    // 7. FONT DETECTION
    function detectFonts() {
        const baseFonts = ['monospace', 'sans-serif', 'serif'];
        const testFonts = [
            'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Helvetica',
            'Georgia', 'Palatino', 'Garamond', 'Comic Sans MS', 'Trebuchet MS',
            'Arial Black', 'Impact', 'Lucida Console', 'Tahoma', 'Geneva'
        ];
        
        let detectedFonts = 0;
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        
        // Create test elements
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.visibility = 'hidden';
        container.style.fontSize = testSize;
        document.body.appendChild(container);
        
        try {
            baseFonts.forEach(baseFont => {
                const baseSpan = document.createElement('span');
                baseSpan.style.fontFamily = baseFont;
                baseSpan.textContent = testString;
                container.appendChild(baseSpan);
                
                const baseWidth = baseSpan.offsetWidth;
                
                testFonts.forEach(font => {
                    const testSpan = document.createElement('span');
                    testSpan.style.fontFamily = `${font}, ${baseFont}`;
                    testSpan.textContent = testString;
                    container.appendChild(testSpan);
                    
                    if (testSpan.offsetWidth !== baseWidth) {
                        detectedFonts++;
                    }
                    
                    container.removeChild(testSpan);
                });
                
                container.removeChild(baseSpan);
            });
            
            document.body.removeChild(container);
            
            // Bots typically have very few fonts
            let suspiciousPoints = 0;
            if (detectedFonts < 5) suspiciousPoints += 0.8;
            else if (detectedFonts < 10) suspiciousPoints += 0.4;
            else if (detectedFonts < 15) suspiciousPoints += 0.2;
            
            detectionResults.fonts = suspiciousPoints;
            return Math.min(suspiciousPoints, 1);
        } catch (e) {
            document.body.removeChild(container);
            detectionResults.fonts = 0.3;
            return 0.3;
        }
    }

    // 8. AUDIO FINGERPRINTING
    function audioFingerprint() {
        return new Promise((resolve) => {
            try {
                if (!window.AudioContext && !window.webkitAudioContext) {
                    detectionResults.audio = 0.6;
                    resolve(0.6);
                    return;
                }
                
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioCtx();
                const oscillator = audioContext.createOscillator();
                const analyser = audioContext.createAnalyser();
                const gainNode = audioContext.createGain();
                const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                
                oscillator.connect(analyser);
                analyser.connect(scriptProcessor);
                scriptProcessor.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                scriptProcessor.onaudioprocess = function(bins) {
                    const data = new Float32Array(analyser.frequencyBinCount);
                    analyser.getFloatFrequencyData(data);
                    
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        sum += Math.abs(data[i]);
                    }
                    
                    oscillator.stop();
                    audioContext.close();
                    
                    // Check for suspicious audio fingerprint
                    let suspiciousPoints = 0;
                    if (sum === 0) suspiciousPoints += 0.8; // No audio processing
                    if (sum < 1000) suspiciousPoints += 0.4; // Unusual audio signature
                    
                    detectionResults.audio = suspiciousPoints;
                    resolve(Math.min(suspiciousPoints, 1));
                };
                
                oscillator.start(0);
                
                // Timeout fallback
                setTimeout(() => {
                    detectionResults.audio = 0.3;
                    resolve(0.3);
                }, 1000);
                
            } catch (e) {
                detectionResults.audio = 0.5;
                resolve(0.5);
            }
        });
    }

    // 9. MOUSE MOVEMENT ANALYSIS
    let mouseData = {
        movements: 0,
        clicks: 0,
        totalDistance: 0,
        lastX: 0,
        lastY: 0,
        velocities: [],
        startTime: Date.now()
    };

    function trackMouse() {
        document.addEventListener('mousemove', function(e) {
            if (mouseData.lastX && mouseData.lastY) {
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseData.lastX, 2) + 
                    Math.pow(e.clientY - mouseData.lastY, 2)
                );
                mouseData.totalDistance += distance;
                mouseData.velocities.push(distance);
            }
            mouseData.lastX = e.clientX;
            mouseData.lastY = e.clientY;
            mouseData.movements++;
        });

        document.addEventListener('click', function() {
            mouseData.clicks++;
        });
    }

    function analyzeMouse() {
        const timeElapsed = (Date.now() - mouseData.startTime) / 1000;
        let suspiciousPoints = 0;
        
        // No mouse activity is highly suspicious
        if (mouseData.movements === 0) suspiciousPoints += 0.9;
        else {
            // Analyze movement patterns
            const avgVelocity = mouseData.velocities.length > 0 ? 
                mouseData.velocities.reduce((a, b) => a + b) / mouseData.velocities.length : 0;
            
            // Too consistent velocity (bot-like)
            if (mouseData.velocities.length > 10) {
                const velocityVariance = mouseData.velocities.reduce((acc, vel) => 
                    acc + Math.pow(vel - avgVelocity, 2), 0) / mouseData.velocities.length;
                
                if (velocityVariance < 10) suspiciousPoints += 0.6; // Too consistent
            }
            
            // No clicks but movement (suspicious)
            if (mouseData.movements > 20 && mouseData.clicks === 0) suspiciousPoints += 0.4;
            
            // Perfect straight lines or geometric patterns
            if (mouseData.velocities.length > 5 && 
                mouseData.velocities.every(v => Math.abs(v - avgVelocity) < 1)) {
                suspiciousPoints += 0.8;
            }
        }
        
        detectionResults.mouse = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 10. KEYBOARD BEHAVIOR
    let keyboardData = {
        keystrokes: 0,
        intervals: [],
        lastKeyTime: 0
    };

    function trackKeyboard() {
        document.addEventListener('keydown', function() {
            const now = Date.now();
            if (keyboardData.lastKeyTime) {
                keyboardData.intervals.push(now - keyboardData.lastKeyTime);
            }
            keyboardData.lastKeyTime = now;
            keyboardData.keystrokes++;
        });
    }

    function analyzeKeyboard() {
        let suspiciousPoints = 0;
        
        if (keyboardData.intervals.length > 5) {
            // Analyze typing rhythm
            const avgInterval = keyboardData.intervals.reduce((a, b) => a + b) / keyboardData.intervals.length;
            const variance = keyboardData.intervals.reduce((acc, interval) => 
                acc + Math.pow(interval - avgInterval, 2), 0) / keyboardData.intervals.length;
            
            // Too consistent timing (bot-like)
            if (variance < 100 && avgInterval < 200) suspiciousPoints += 0.7;
            
            // Impossibly fast typing
            if (avgInterval < 50) suspiciousPoints += 0.8;
        }
        
        detectionResults.keyboard = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 11. SCROLL BEHAVIOR
    let scrollData = {
        scrolls: 0,
        distances: [],
        lastScrollY: 0
    };

    function trackScroll() {
        window.addEventListener('scroll', function() {
            const distance = Math.abs(window.scrollY - scrollData.lastScrollY);
            scrollData.distances.push(distance);
            scrollData.lastScrollY = window.scrollY;
            scrollData.scrolls++;
        });
    }

    function analyzeScroll() {
        let suspiciousPoints = 0;
        
        if (scrollData.scrolls === 0) {
            suspiciousPoints += 0.3; // Some pages require scrolling
        } else if (scrollData.distances.length > 5) {
            // Check for robotic scrolling patterns
            const avgDistance = scrollData.distances.reduce((a, b) => a + b) / scrollData.distances.length;
            const isConstantScrolling = scrollData.distances.every(d => Math.abs(d - avgDistance) < 10);
            
            if (isConstantScrolling && avgDistance > 100) {
                suspiciousPoints += 0.6; // Perfectly consistent large scrolls
            }
        }
        
        detectionResults.scroll = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 12. FOCUS/BLUR EVENTS
    let focusData = {
        focusCount: 0,
        blurCount: 0,
        isVisible: true
    };

    function trackFocus() {
        window.addEventListener('focus', () => {
            focusData.focusCount++;
            focusData.isVisible = true;
        });

        window.addEventListener('blur', () => {
            focusData.blurCount++;
            focusData.isVisible = false;
        });

        // Page visibility API
        document.addEventListener('visibilitychange', () => {
            focusData.isVisible = !document.hidden;
        });
    }

    function analyzeFocus() {
        let suspiciousPoints = 0;
        
        // Bots often don't trigger focus/blur events naturally
        if (focusData.focusCount === 0 && focusData.blurCount === 0) {
            suspiciousPoints += 0.4;
        }
        
        detectionResults.focus = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // 13. TIMING ATTACKS
    function timingAnalysis() {
        let suspiciousPoints = 0;
        
        // setTimeout drift test
        const start = performance.now();
        let drifts = [];
        let completedTests = 0;
        
        return new Promise((resolve) => {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const expected = start + (i + 1) * 100;
                    const actual = performance.now();
                    const drift = Math.abs(actual - expected);
                    drifts.push(drift);
                    
                    completedTests++;
                    if (completedTests === 5) {
                        // Analyze timing consistency
                        const avgDrift = drifts.reduce((a, b) => a + b) / drifts.length;
                        
                        // Headless browsers often have different timing characteristics
                        if (avgDrift < 1) suspiciousPoints += 0.6; // Too precise
                        if (avgDrift > 50) suspiciousPoints += 0.4; // Too imprecise
                        
                        // requestAnimationFrame test
                        let rafTimes = [];
                        let rafCount = 0;
                        
                        function rafTest() {
                            rafTimes.push(performance.now());
                            rafCount++;
                            
                            if (rafCount < 5) {
                                requestAnimationFrame(rafTest);
                            } else {
                                // Analyze RAF intervals
                                let intervals = [];
                                for (let j = 1; j < rafTimes.length; j++) {
                                    intervals.push(rafTimes[j] - rafTimes[j-1]);
                                }
                                
                                const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
                                
                                // Unusual RAF timing
                                if (avgInterval < 10 || avgInterval > 20) suspiciousPoints += 0.3;
                                
                                detectionResults.timing = suspiciousPoints;
                                resolve(Math.min(suspiciousPoints, 1));
                            }
                        }
                        
                        requestAnimationFrame(rafTest);
                    }
                }, (i + 1) * 100);
            }
        });
    }

    // 14. NETWORK TESTS
    function networkTests() {
        return new Promise((resolve) => {
            let suspiciousPoints = 0;
            
            // Test image loading (some bots block images)
            const img = new Image();
            const startTime = performance.now();
            
            img.onload = function() {
                const loadTime = performance.now() - startTime;
                // Unusually fast loading might indicate caching or blocking
                if (loadTime < 1) suspiciousPoints += 0.3;
            };
            
            img.onerror = function() {
                // Image loading blocked
                suspiciousPoints += 0.5;
            };
            
            // Use a 1x1 transparent pixel
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            
            // Cookie test
            try {
                document.cookie = 'bottest=1; max-age=1';
                const cookieExists = document.cookie.includes('bottest=1');
                if (!cookieExists) suspiciousPoints += 0.3;
            } catch (e) {
                suspiciousPoints += 0.4; // Cookie access blocked
            }
            
            // LocalStorage test (but don't actually use it per restrictions)
            try {
                if (typeof Storage === 'undefined') suspiciousPoints += 0.2;
            } catch (e) {
                suspiciousPoints += 0.2;
            }
            
            setTimeout(() => {
                detectionResults.network = suspiciousPoints;
                resolve(Math.min(suspiciousPoints, 1));
            }, 100);
        });
    }

    // 15. CHALLENGE-RESPONSE TRAPS
    function setupTraps() {
        let suspiciousPoints = 0;
        
        // Hidden input field (bots might auto-fill)
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'text';
        hiddenInput.style.opacity = '0';
        hiddenInput.style.position = 'absolute';
        hiddenInput.style.left = '-9999px';
        hiddenInput.name = 'bot_trap_field';
        hiddenInput.tabIndex = -1;
        document.body.appendChild(hiddenInput);
        
        // Check if it gets filled
        setTimeout(() => {
            if (hiddenInput.value.length > 0) {
                suspiciousPoints += 0.9; // Hidden field was filled
            }
        }, 500);
        
        // Invisible element interaction trap
        const invisibleDiv = document.createElement('div');
        invisibleDiv.style.width = '1px';
        invisibleDiv.style.height = '1px';
        invisibleDiv.style.position = 'absolute';
        invisibleDiv.style.left = '-9999px';
        invisibleDiv.style.cursor = 'pointer';
        document.body.appendChild(invisibleDiv);
        
        invisibleDiv.addEventListener('click', function() {
            suspiciousPoints += 0.8; // Invisible element was clicked
        });
        
        // CSS-based trap (element visible only to bots that ignore CSS)
        const cssTrapped = document.createElement('div');
        cssTrapped.innerHTML = '<a href="#" style="display:none;">Bot trap link</a>';
        cssTrapped.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                suspiciousPoints += 0.9;
                e.preventDefault();
            }
        });
        document.body.appendChild(cssTrapped);
        
        detectionResults.traps = suspiciousPoints;
        return suspiciousPoints;
    }

    // 16. ADVANCED DETECTION METHODS
    function advancedDetection() {
        let suspiciousPoints = 0;
        
        // === COMPREHENSIVE BOT FRAMEWORK DETECTION ===
        const botGlobals = [
            // PhantomJS
            'phantom', '_phantom', '__phantomas', 'callPhantom',
            // Selenium
            'selenium', 'webdriver', '__selenium_unwrapped', '__webdriverActive',
            '__selenium_evaluate', '__webdriver_evaluate', '__driver_evaluate',
            '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
            '__fxdriver_unwrapped', '__webdriver_script_fn', '_Selenium_IDE_Recorder',
            // Playwright
            '__playwright', 'playwright',
            // Nightmare.js
            '__nightmare', 'nightmare',
            // SlimerJS
            'slimer',
            // General automation
            'domAutomation', 'domAutomationController',
            // WebDriver extensions
            '__webdriver_chrome_console', '__webdriver_chrome_runtime'
        ];
        
        botGlobals.forEach(global => {
            if (window[global] !== undefined) {
                // Higher penalty for more definitive bot indicators
                if (['phantom', '_phantom', '__selenium_unwrapped', '__playwright', 'webdriver'].includes(global)) {
                    suspiciousPoints += 0.4;
                } else {
                    suspiciousPoints += 0.2;
                }
            }
        });
        
        // === USER AGENT SPECIFIC CHECKS ===
        const ua = navigator.userAgent;
        const suspiciousUAPatterns = [
            'HeadlessChrome', 'PhantomJS', 'SlimerJS', 'Playwright', 'puppeteer'
        ];
        
        suspiciousUAPatterns.forEach(pattern => {
            if (ua.includes(pattern)) suspiciousPoints += 0.3;
        });
        
        // === DOCUMENT PROPERTY CHECKS ===
        const htmlElement = document.documentElement;
        const suspiciousAttributes = ['webdriver', 'selenium', 'driver'];
        
        suspiciousAttributes.forEach(attr => {
            if (htmlElement.getAttribute(attr)) suspiciousPoints += 0.3;
        });
        
        // === FUNCTION MODIFICATION DETECTION ===
        // Check for modified built-in functions (common in automation)
        try {
            if (!Date.prototype.getTimezoneOffset.toString().includes('native code')) {
                suspiciousPoints += 0.4;
            }
            if (!JSON.stringify.toString().includes('native code')) {
                suspiciousPoints += 0.3;
            }
            if (!Array.prototype.forEach.toString().includes('native code')) {
                suspiciousPoints += 0.3;
            }
        } catch (e) {
            // Function inspection blocked
            suspiciousPoints += 0.2;
        }
        
        // === ERROR STACK TRACE ANALYSIS ===
        try {
            throw new Error('BotDetectionTest');
        } catch (e) {
            const stack = e.stack || '';
            const automationIndicators = [
                'puppeteer', 'selenium', 'phantom', 'nightmare', 
                'slimer', 'playwright', 'webdriver'
            ];
            
            automationIndicators.forEach(indicator => {
                if (stack.toLowerCase().includes(indicator)) {
                    suspiciousPoints += 0.8;
                }
            });
        }
        
        // === RUNTIME ENVIRONMENT CHECKS ===
        // Node.js process object (Electron, but also some automation tools)
        if (typeof process !== 'undefined' && process.versions) {
            if (process.versions.electron) {
                // Electron detection (lower suspicion as legitimate apps use it)
                suspiciousPoints += 0.2;
            }
            if (process.versions.node && !process.versions.electron) {
                // Node.js without Electron is suspicious in browser context
                suspiciousPoints += 0.6;
            }
        }
        
        // === PERMISSIONS API BEHAVIOR ===
        if (navigator.permissions && navigator.permissions.query) {
            try {
                navigator.permissions.query({name: 'notifications'}).then(result => {
                    // Headless browsers often have different permission states
                    if (result.state === 'denied' && 'Notification' in window && 
                        Notification.permission !== 'denied') {
                        suspiciousPoints += 0.3;
                    }
                }).catch(() => {
                    suspiciousPoints += 0.1;
                });
                
                // Test multiple permissions for consistency
                navigator.permissions.query({name: 'geolocation'}).then(geoResult => {
                    navigator.permissions.query({name: 'camera'}).then(camResult => {
                        // If all permissions are denied, might be automated environment
                        if (geoResult.state === 'denied' && camResult.state === 'denied') {
                            suspiciousPoints += 0.2;
                        }
                    }).catch(() => {});
                }).catch(() => {});
            } catch (e) {
                suspiciousPoints += 0.1;
            }
        }
        
        // === BATTERY API (deprecated but useful) ===
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                // Virtual machines/headless often report no battery or full charge
                if (battery.level === 1.0 && !battery.charging && battery.chargingTime === Infinity) {
                    suspiciousPoints += 0.3;
                }
                // Unusual discharge rates
                if (battery.dischargingTime !== Infinity && battery.dischargingTime < 3600) {
                    suspiciousPoints += 0.1;
                }
            }).catch(() => {
                // Battery API access denied
                suspiciousPoints += 0.1;
            });
        }
        
        // === CONNECTION API ===
        if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            // Unusual connection types in automation environments
            if (connection.effectiveType === 'slow-2g' && connection.downlink === 0) {
                suspiciousPoints += 0.2;
            }
        }
        
        detectionResults.advanced = suspiciousPoints;
        return Math.min(suspiciousPoints, 1);
    }

    // Initialize behavioral tracking
    function initializeTracking() {
        trackMouse();
        trackKeyboard();
        trackScroll();
        trackFocus();
    }

    // Calculate final bot score
    function calculateBotScore() {
        let totalWeightedScore = 0;
        let totalMaxWeight = 0;
        
        Object.keys(weights).forEach(category => {
            if (detectionResults[category] !== undefined) {
                totalWeightedScore += detectionResults[category] * weights[category];
                totalMaxWeight += weights[category];
            }
        });
        
        return totalMaxWeight > 0 ? Math.min(totalWeightedScore / totalMaxWeight, 1) : 0;
    }

    // Get human readable assessment
    function getAssessment(score) {
        if (score < 0.3) return 'likely human';
        if (score < 0.6) return 'suspicious';
        if (score < 0.8) return 'likely bot';
        return 'definitely bot';
    }

    // Main execution function
    async function runBotDetection() {
        console.log('🤖 Bot Detection Script Starting...');
        
        // Initialize tracking first
        initializeTracking();
        
        // Run synchronous tests immediately
        analyzeUserAgent();
        checkNavigatorProperties();
        detectHeadless();
        detectWebDriver();
        canvasFingerprint();
        webglFingerprint();
        detectFonts();
        setupTraps();
        advancedDetection();
        
        // Wait for asynchronous tests
        await audioFingerprint();
        await timingAnalysis();
        await networkTests();
        
        // Wait a bit for behavioral data collection
        setTimeout(() => {
            analyzeMouse();
            analyzeKeyboard();
            analyzeScroll();
            analyzeFocus();
            
            // Calculate final score
            const finalScore = calculateBotScore();
            const assessment = getAssessment(finalScore);
            
            // Output final result
            console.log(`Bot score: ${finalScore.toFixed(2)} (${assessment})`);
            
            // Optional: Show detailed breakdown
            if (window.location.search.includes('debug=true')) {
                console.table(detectionResults);
                console.log('Weights:', weights);
            }
            
        }, 2000); // Allow 2 seconds for behavioral data collection
    }

    // Start the detection
    runBotDetection();

})();