// Konfigurasi MQTT
const BROKER_URL = 'wss://test.mosquitto.org:8081'; // Public test broker
const TOPIC_TEMP = 'iot/suhu';
const TOPIC_HUM = 'iot/kelembapan';
const CLIENT_ID = 'web_dashboard_' + Math.random().toString(16).substr(2, 8);

// Data untuk grafik
let timeLabels = [];
let tempData = [];
let humData = [];
let chart;

// Inisialisasi grafik
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
                    tension: 0.4
                },
                {
                    label: 'Kelembapan (%)',
                    data: humData,
                    borderColor: 'rgb(54, 162, 235)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
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
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
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

// Update tampilan dan grafik
function updateDisplay(temp, hum) {
    // Update card
    document.getElementById('temp').innerHTML = temp + '°C';
    document.getElementById('hum').innerHTML = hum + '%';
    
    // Update grafik
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    timeLabels.push(timeStr);
    tempData.push(temp);
    humData.push(hum);
    
    // Batasi data terbaru hingga 20 titik
    if (timeLabels.length > 20) {
        timeLabels.shift();
        tempData.shift();
        humData.shift();
    }
    
    chart.update();
}

// Koneksi MQTT
function connectMQTT() {
    const client = mqtt.connect(BROKER_URL, {
        clientId: CLIENT_ID,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000
    });
    
    client.on('connect', () => {
        console.log('✅ Terhubung ke MQTT broker');
        client.subscribe([TOPIC_TEMP, TOPIC_HUM], (err) => {
            if (!err) {
                console.log('📡 Subscribe ke topik:', TOPIC_TEMP, 'dan', TOPIC_HUM);
            }
        });
    });
    
    client.on('message', (topic, message) => {
        const value = parseFloat(message.toString());
        if (!isNaN(value)) {
            if (topic === TOPIC_TEMP) {
                currentTemp = value;
            } else if (topic === TOPIC_HUM) {
                currentHum = value;
            }
            
            // Update jika kedua nilai sudah tersedia
            if (currentTemp !== null && currentHum !== null) {
                updateDisplay(currentTemp, currentHum);
                // Reset untuk data berikutnya
                currentTemp = null;
                currentHum = null;
            }
        }
    });
    
    client.on('error', (err) => {
        console.error('❌ MQTT Error:', err);
    });
    
    client.on('reconnect', () => {
        console.log('🔄 MQTT Reconnecting...');
    });
    
    return client;
}

// Simulasi data jika tidak ada koneksi MQTT (untuk testing/development)
function startSimulation() {
    console.log('🎮 Menggunakan mode simulasi (tidak ada koneksi MQTT)');
    let temp = 25;
    let hum = 60;
    
    setInterval(() => {
        // Simulasi perubahan suhu dan kelembapan
        temp = 25 + Math.sin(Date.now() / 10000) * 5 + (Math.random() - 0.5) * 1;
        hum = 60 + Math.cos(Date.now() / 8000) * 10 + (Math.random() - 0.5) * 3;
        
        updateDisplay(temp.toFixed(1), hum.toFixed(1));
    }, 3000);
}

// Variabel untuk menyimpan data sementara
let currentTemp = null;
let currentHum = null;

// Inisialisasi
window.addEventListener('load', () => {
    initChart();
    
    // Coba konek ke MQTT, jika gagal atau timeout gunakan simulasi
    let mqttConnected = false;
    
    try {
        const client = connectMQTT();
        
        // Timeout untuk fallback ke simulasi
        setTimeout(() => {
            if (!mqttConnected) {
                console.log('⏱ Timeout koneksi MQTT, beralih ke simulasi');
                if (client && client.end) client.end();
                startSimulation();
            }
        }, 5000);
        
        // Override untuk mendeteksi koneksi berhasil
        const originalOn = client.on;
        client.on = function(event, callback) {
            if (event === 'connect') {
                mqttConnected = true;
            }
            return originalOn.call(this, event, callback);
        };
        
    } catch (error) {
        console.log('Gagal koneksi MQTT, menggunakan mode simulasi');
        startSimulation();
    }
});
