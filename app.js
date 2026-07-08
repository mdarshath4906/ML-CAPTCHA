document.addEventListener('DOMContentLoaded', () => {
    // CAPTCHA State Variables
    let currentCaptcha = "";
    let mouseMoveCount = 0;
    let startTime = null;
    let timerInterval = null;
    let isTrackingActive = true;
    let lastMouseX = null;
    let lastMouseY = null;

    // DOM Elements
    const captchaCodeEl = document.getElementById('captcha-code');
    const refreshBtn = document.getElementById('refresh-btn');
    const captchaInput = document.getElementById('captcha-input');
    const trackingZone = document.getElementById('tracking-zone');
    const trailCanvas = document.getElementById('trail-canvas');
    const form = document.getElementById('captcha-form');
    const btnSubmit = document.getElementById('btn-submit');
    const btnSimulateBot = document.getElementById('btn-simulate-bot');
    const btnRetrain = document.getElementById('btn-retrain');
    const accuracyValueEl = document.getElementById('accuracy-value');
    
    // Telemetry display elements
    const valLength = document.getElementById('val-length');
    const valTime = document.getElementById('val-time');
    const valMouse = document.getElementById('val-mouse');
    const barLength = document.getElementById('bar-length');
    const barTime = document.getElementById('bar-time');
    const barMouse = document.getElementById('bar-mouse');

    // Hidden form fields
    const lengthField = document.getElementById('length-field');
    const timeField = document.getElementById('time-field');
    const mouseField = document.getElementById('mouse-field');

    // Scanning screen and toast
    const scanningScreen = document.getElementById('scanning-screen');
    const scanMetricsFeed = document.getElementById('scan-metrics-feed');
    const systemToast = document.getElementById('system-toast');
    const toastMessage = document.getElementById('toast-message');

    // Canvas Setup
    const ctx = trailCanvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function resizeCanvas() {
        const rect = trackingZone.getBoundingClientRect();
        trailCanvas.width = rect.width;
        trailCanvas.height = rect.height;
    }

    // 1. Generate CAPTCHA
    function generateCaptcha() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // omit ambiguous chars like 1, l, O, 0
        const length = Math.floor(Math.random() * 3) + 5; // 5 to 7 characters
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        currentCaptcha = result;
        captchaCodeEl.textContent = result;
        
        // Reset telemetry
        resetTelemetry(length);
    }

    // 2. Reset Telemetry Metrics
    function resetTelemetry(length) {
        mouseMoveCount = 0;
        lastMouseX = null;
        lastMouseY = null;
        isTrackingActive = true;
        
        // Clear canvas
        ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        
        // Set start time
        startTime = Date.now();
        
        // Start timers
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(updateTimeTelemetry, 50);

        // Update display values
        valLength.textContent = length;
        barLength.style.width = `${(length / 8) * 100}%`;
        
        updateMouseTelemetryDisplay();
        updateTimeTelemetry();
    }

    // 3. Update Time Telemetry
    function updateTimeTelemetry() {
        if (!startTime || !isTrackingActive) return;
        const elapsed = (Date.now() - startTime) / 1000;
        valTime.textContent = `${elapsed.toFixed(2)}s`;
        // Scale bar to max 15 seconds
        const barWidth = Math.min((elapsed / 15) * 100, 100);
        barTime.style.width = `${barWidth}%`;
    }

    // 4. Track Mouse Movements in Sandbox
    trackingZone.addEventListener('mousemove', (e) => {
        if (!isTrackingActive) return;

        const rect = trackingZone.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Increment move count
        mouseMoveCount++;
        updateMouseTelemetryDisplay();

        // Draw trail with neon glow
        if (lastMouseX !== null && lastMouseY !== null) {
            ctx.beginPath();
            ctx.moveTo(lastMouseX, lastMouseY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = '#00f2fe';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 242, 254, 0.8)';
            ctx.stroke();
        }

        lastMouseX = x;
        lastMouseY = y;
    });

    // Fading effect for mouse trail canvas
    setInterval(() => {
        if (!isTrackingActive) return;
        ctx.fillStyle = 'rgba(10, 13, 20, 0.08)';
        ctx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);
    }, 50);

    function updateMouseTelemetryDisplay() {
        valMouse.textContent = mouseMoveCount;
        // Scale bar to max 100 movements
        const barWidth = Math.min((mouseMoveCount / 100) * 100, 100);
        barMouse.style.width = `${barWidth}%`;
    }

    // Initialize CAPTCHA
    generateCaptcha();

    // Refresh button event listener
    refreshBtn.addEventListener('click', generateCaptcha);

    // Update length dynamically if typing
    captchaInput.addEventListener('input', () => {
        const inputLen = captchaInput.value.length;
        valLength.textContent = inputLen;
        barLength.style.width = `${Math.min((inputLen / 8) * 100, 100)}%`;
    });

    // Toast show helper
    function showToast(message) {
        toastMessage.textContent = message;
        systemToast.classList.add('active');
        setTimeout(() => {
            systemToast.classList.remove('active');
        }, 3000);
    }

    // 5. Submit Form (Human flow)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate Captcha Text Match First
        const userTyped = captchaInput.value.trim();
        if (userTyped.toLowerCase() !== currentCaptcha.toLowerCase()) {
            showToast("Invalid CAPTCHA code. Please try again.");
            generateCaptcha();
            captchaInput.value = "";
            return;
        }

        // Freeze tracking
        isTrackingActive = false;
        clearInterval(timerInterval);

        // Fetch metrics
        const length = currentCaptcha.length;
        const timeTaken = (Date.now() - startTime) / 1000;
        const mouseMoves = mouseMoveCount;

        // Set form fields
        lengthField.value = length;
        timeField.value = timeTaken;
        mouseField.value = mouseMoves;

        // Show scanning animation
        await runScanningOverlay(length, timeTaken, mouseMoves);

        // Model Classification
        try {
            const response = await fetch('/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    length: length,
                    time: timeTaken,
                    mouse: mouseMoves
                })
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                // If it is human, save to database as Human (1)
                // If it is classified as bot, save to database as Bot (0)
                const resultVal = data.prediction === "Human" ? 1 : 0;
                await logInteractionToCSV(length, timeTaken, mouseMoves, resultVal);

                // Perform conventional redirection to show results screen
                form.submit();
            } else {
                form.submit(); // fallback in case API fails
            }
        } catch (err) {
            console.error("AJAX Error: ", err);
            form.submit(); // Submit conventionally on failure
        }
    });

    // 6. Bot Simulation Flow
    btnSimulateBot.addEventListener('click', async () => {
        // Freeze tracking
        isTrackingActive = false;
        clearInterval(timerInterval);

        // Fill CAPTCHA with correct letters instantly
        captchaInput.value = currentCaptcha;

        // Robot metrics
        const length = currentCaptcha.length;
        const timeTaken = parseFloat((Math.random() * 0.3 + 0.1).toFixed(2)); // ultra fast 0.1s - 0.4s
        const mouseMoves = 0; // zero movement events

        // Set hidden fields
        lengthField.value = length;
        timeField.value = timeTaken;
        mouseField.value = mouseMoves;

        // Draw straight/robotic line on canvas
        ctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        ctx.beginPath();
        ctx.moveTo(20, trailCanvas.height / 2);
        ctx.lineTo(trailCanvas.width - 20, trailCanvas.height / 2);
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Update displays
        valTime.textContent = `${timeTaken}s`;
        barTime.style.width = `${(timeTaken / 15) * 100}%`;
        valMouse.textContent = mouseMoves;
        barMouse.style.width = '0%';

        // Show scanner with robot stats
        await runScanningOverlay(length, timeTaken, mouseMoves, true);

        // Log Bot event to database (result = 0)
        await logInteractionToCSV(length, timeTaken, mouseMoves, 0);

        // Submit form to load result page
        form.submit();
    });

    // Helper to log stats to backend CSV
    async function logInteractionToCSV(length, time, mouse, result) {
        try {
            await fetch('/add_data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    length: length,
                    time: time,
                    mouse: mouse,
                    result: result
                })
            });
        } catch (e) {
            console.error("Error saving data log: ", e);
        }
    }

    // Scanning screen visual effect
    function runScanningOverlay(length, time, mouse, isBot = false) {
        return new Promise((resolve) => {
            scanningScreen.classList.add('active');
            
            // Console logs simulated
            scanMetricsFeed.innerHTML = "";
            const logs = [
                `[SYSTEM] Connecting to verification backend...`,
                `[TELEMETRY] Captcha characters length: ${length}`,
                `[TELEMETRY] Solve execution time: ${time.toFixed(2)}s`,
                `[TELEMETRY] Mouse movements registered: ${mouse} coordinates`,
                `[MODEL] Executing sklearn.DecisionTreeClassifier.predict()`,
                isBot ? `[SECURITY] FATAL: Non-human activity detected. Processing lockdown...` : `[SECURITY] Success: Telemetry profile matches normal behavior.`
            ];

            let index = 0;
            const logInterval = setInterval(() => {
                if (index < logs.length) {
                    const line = document.createElement('div');
                    line.textContent = logs[index];
                    if (logs[index].includes('FATAL') || logs[index].includes('SECURITY')) {
                        line.style.color = isBot ? '#ff007f' : '#39ff14';
                    }
                    scanMetricsFeed.appendChild(line);
                    scanMetricsFeed.scrollTop = scanMetricsFeed.scrollHeight;
                    index++;
                } else {
                    clearInterval(logInterval);
                    setTimeout(() => {
                        scanningScreen.classList.remove('active');
                        resolve();
                    }, 500);
                }
            }, 250);
        });
    }

    // 7. Retrain Model Action
    btnRetrain.addEventListener('click', async () => {
        btnRetrain.disabled = true;
        btnRetrain.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Retraining...';
        
        try {
            const response = await fetch('/retrain', { method: 'POST' });
            const data = await response.json();
            if (data.status === 'success') {
                showToast(`Model Retrained! New Accuracy: ${data.accuracy}`);
                accuracyValueEl.textContent = data.accuracy;
                
                // Refresh table and accuracy after a small delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showToast(`Error: ${data.message}`);
                btnRetrain.disabled = false;
                btnRetrain.innerHTML = '<i class="fa-solid fa-dumbbell"></i> Retrain Model';
            }
        } catch (e) {
            console.error(e);
            showToast("Failed to connect to retrain API.");
            btnRetrain.disabled = false;
            btnRetrain.innerHTML = '<i class="fa-solid fa-dumbbell"></i> Retrain Model';
        }
    });
});
