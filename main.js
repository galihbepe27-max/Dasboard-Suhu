// ================= KONFIGURASI MQTT =================
// GANTI dari WSS menjadi WS (non-SSL)
const BROKER_URL = 'ws://broker.hivemq.com:8000';  // Port 8000 untuk WebSocket non-SSL

// TOPIK - Tetap sama
const TOPIC_TEMP = 'esp32/suhu/iot_project_2026';
const TOPIC_HUM = 'esp32/humidity/iot_project_2026';

// Client ID unik untuk setiap session
const CLIENT_ID = 'web_dashboard_' + Math.random().toString(36).substr(2, 9);

// ================= VARIABEL GLOBAL =================
let timeLabels = [];
let tempData = [];
let humData = [];
let chart;
let currentTemp = null;
let currentHum = null;
let tempReadings = [];
let humReadings = [];
let mqttClient = null;
let isSimulating = false;

// ================= INISIALISASI GRAFIK =================
function initChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'Suhu (°C)',
                    data: tempData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                },
                {
                    label: 'Kelembapan (%)',
                    data: humData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Nilai'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Waktu'
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// ================= UPDATE STATISTIK =================
function updateStatistics() {
    if (tempReadings.length > 0) {
        const tempMax = Math.max(...tempReadings);
        const tempMin = Math.min(...tempReadings);
        const tempAvg = tempReadings.reduce((a, b) => a + b, 0) / tempReadings.length;
        
        document.getElementById('temp-max').textContent = tempMax.toFixed(1);
        document.getElementById('temp-min').textContent = tempMin.toFixed(1);
        document.getElementById('temp-avg').textContent = tempAvg.toFixed(1);
    }
    
    if (humReadings.length > 0) {
        const humMax = Math.max(...humReadings);
        const humMin = Math.min(...humReadings);
        const humAvg = humReadings.reduce((a, b) => a + b, 0) / humReadings.length;
        
        document.getElementById('hum-max').textContent = humMax.toFixed(1);
        document.getElementById('hum-min').textContent = humMin.toFixed(1);
        document.getElementById('hum-avg').textContent = humAvg.toFixed(1);
    }
}

// ================= UPDATE STATUS KONEKSI =================
function updateConnectionStatus(status, message) {
    const statusDiv = document.getElementById('connection-status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'status-badge ' + status;
    }
}

// ================= UPDATE TAMPILAN DAN GRAFIK =================
function updateDisplay(temp, hum) {
    // Update card
    const tempElement = document.getElementById('temp');
    const humElement = document.getElementById('hum');
    
    if (tempElement) tempElement.innerHTML = temp + '°C';
    if (humElement) humElement.innerHTML = hum + '%';
    
    // Simpan untuk statistik
    const tempNum = parseFloat(temp);
    const humNum = parseFloat(hum);
    
    if (!isNaN(tempNum)) {
        tempReadings.push(tempNum);
        if (tempReadings.length > 50) tempReadings.shift();
    }
    
    if (!isNaN(humNum)) {
        humReadings.push(humNum);
        if (humReadings.length > 50) humReadings.shift();
    }
    
    updateStatistics();
    
    // Update grafik
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    timeLabels.push(timeStr);
    tempData.push(tempNum);
    humData.push(humNum);
    
    // Batasi data terbaru hingga 30 titik
    if (timeLabels.length > 30) {
        timeLabels.shift();
        tempData.shift();
        humData.shift();
    }
    
    if (chart) chart.update();
}

// ================= KONEKSI MQTT =================
function connectMQTT() {
    console.log('🔌 Menghubungkan ke MQTT broker:', BROKER_URL);
    updateConnectionStatus('', '⏳ Menghubungkan ke MQTT...');
    
    const client = mqtt.connect(BROKER_URL, {
        clientId: CLIENT_ID,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        keepalive: 60
    });
    
    client.on('connect', () => {
        console.log('✅ Terhubung ke MQTT broker');
        updateConnectionStatus('connected', '✅ Terhubung ke MQTT (Real-time)');
        isSimulating = false;
        
        // Subscribe ke kedua topik
        client.subscribe([TOPIC_TEMP, TOPIC_HUM], { qos: 0 }, (err) => {
            if (!err) {
                console.log('📡 Subscribe ke topik:');
                console.log('   -', TOPIC_TEMP);
                console.log('   -', TOPIC_HUM);
            } else {
                console.error('❌ Gagal subscribe:', err);
                updateConnectionStatus('disconnected', '⚠️ Gagal subscribe ke topik');
            }
        });
    });
    
    client.on('message', (topic, message) => {
        const value = parseFloat(message.toString());
        
        if (!isNaN(value)) {
            if (topic === TOPIC_TEMP) {
                currentTemp = value;
                console.log('📊 Suhu dari ESP32:', value, '°C');
            } else if (topic === TOPIC_HUM) {
                currentHum = value;
                console.log('📊 Kelembapan dari ESP32:', value, '%');
            }
            
            // Update jika kedua data sudah diterima
            if (currentTemp !== null && currentHum !== null) {
                updateDisplay(currentTemp.toFixed(1), currentHum.toFixed(1));
                currentTemp = null;
                currentHum = null;
            }
        }
    });
    
    client.on('error', (err) => {
        console.error('❌ MQTT Error:', err);
        updateConnectionStatus('disconnected', '❌ Error MQTT');
    });
    
    client.on('reconnect', () => {
        console.log('🔄 MQTT Reconnecting...');
        updateConnectionStatus('', '🔄 Menghubungkan ulang...');
    });
    
    client.on('offline', () => {
        console.log('📴 MQTT Offline');
        if (!isSimulating) {
            updateConnectionStatus('disconnected', '📴 MQTT Terputus');
        }
    });
    
    return client;
}

// ================= SIMULASI DATA (FALLBACK) =================
function startSimulation() {
    if (isSimulating) return;
    
    isSimulating = true;
    console.log('🎮 Mode simulasi aktif - menggunakan data dummy');
    updateConnectionStatus('simulating', '🎮 Mode Simulasi (Demo)');
    
    let temp = 26.5;
    let hum = 65.0;
    
    // Tampilkan data pertama
    updateDisplay(temp.toFixed(1), hum.toFixed(1));
    
    // Update setiap 3 detik
    setInterval(() => {
        if (isSimulating) {
            // Simulasi perubahan suhu (22-32°C) dan kelembapan (50-80%)
            temp = 27 + Math.sin(Date.now() / 10000) * 4 + (Math.random() - 0.5) * 1;
            hum = 65 + Math.cos(Date.now() / 8000) * 10 + (Math.random() - 0.5) * 3;
            
            // Batasi range
            temp = Math.min(35, Math.max(20, temp));
            hum = Math.min(85, Math.max(45, hum));
            
            updateDisplay(temp.toFixed(1), hum.toFixed(1));
        }
    }, 3000);
}

// ================= CEK KONEKSI MQTT =================
function testMQTTConnection() {
    console.log('🧪 Testing MQTT koneksi ke', BROKER_URL);
    
    const testClient = mqtt.connect(BROKER_URL, {
        clientId: 'test_' + Math.random().toString(36).substr(2, 5),
        clean: true,
        connectTimeout: 5000
    });
    
    testClient.on('connect', () => {
        console.log('✅ MQTT Broker tersedia!');
        testClient.end();
    });
    
    testClient.on('error', (err) => {
        console.log('❌ MQTT Broker tidak dapat dijangkau:', err.message);
    });
}

// ================= INISIALISASI =================
window.addEventListener('load', () => {
    console.log('🚀 Dashboard Monitoring IoT dimulai');
    console.log('📡 Topik MQTT:');
    console.log('   - Suhu:', TOPIC_TEMP);
    console.log('   - Kelembapan:', TOPIC_HUM);
    
    initChart();
    
    // Test koneksi MQTT
    testMQTTConnection();
    
    let mqttConnected = false;
    
    try {
        mqttClient = connectMQTT();
        
        // Timeout untuk fallback ke simulasi (10 detik)
        setTimeout(() => {
            if (!mqttConnected && !isSimulating) {
                console.log('⏱ Timeout koneksi MQTT (10 detik), beralih ke mode simulasi');
                if (mqttClient && mqttClient.end) {
                    mqttClient.end();
                }
                startSimulation();
            }
        }, 10000);
        
        // Override untuk mendeteksi koneksi berhasil
        const originalOn = mqttClient.on;
        mqttClient.on = function(event, callback) {
            if (event === 'connect') {
                mqttConnected = true;
                console.log('🎉 MQTT Connected! Menerima data real-time dari ESP32');
            }
            return originalOn.call(this, event, callback);
        };
        
    } catch (error) {
        console.error('❌ Gagal inisiasi MQTT:', error);
        startSimulation();
    }
});

// Cleanup saat halaman ditutup
window.addEventListener('beforeunload', () => {
    if (mqttClient && mqttClient.end) {
        mqttClient.end();
    }
});
