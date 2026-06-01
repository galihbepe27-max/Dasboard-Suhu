const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

const tempText = document.getElementById('temp');
const humText = document.getElementById('hum');
const ctx = document.getElementById('chart');

// TOPIC
const TOPIC_SUHU = 'esp32/suhu/iot_project_2026';
const TOPIC_HUM = 'esp32/humidity/iot_project_2026';

// BUFFER DATA (INI KUNCI FIX)
let suhu = null;
let hum = null;

// CHART
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Suhu (°C)',
                data: [],
                borderColor: 'red',
                tension: 0.3
            },
            {
                label: 'Humidity (%)',
                data: [],
                borderColor: 'blue',
                tension: 0.3
            }
        ]
    },
    options: {
        responsive: true,
        animation: false
    }
});

// MQTT CONNECT
client.on('connect', () => {
    console.log("MQTT CONNECTED");

    client.subscribe(TOPIC_SUHU);
    client.subscribe(TOPIC_HUM);
});

// MESSAGE HANDLER
client.on('message', (topic, message) => {

    const value = parseFloat(message.toString());
    const time = new Date().toLocaleTimeString();

    if (isNaN(value)) return;

    // UPDATE SUHU
    if (topic === TOPIC_SUHU) {
        suhu = value;
        tempText.innerHTML = value.toFixed(2) + " °C";
    }

    // UPDATE HUMIDITY
    if (topic === TOPIC_HUM) {
        hum = value;
        humText.innerHTML = value.toFixed(2) + " %";
    }

    // 🔥 PENTING: hanya update chart kalau 2 data sudah ada
    if (suhu !== null && hum !== null) {

        chart.data.labels.push(time);
        chart.data.datasets[0].data.push(suhu);
        chart.data.datasets[1].data.push(hum);

        // LIMIT DATA
        if (chart.data.labels.length > 10) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }

        chart.update();
    }
});