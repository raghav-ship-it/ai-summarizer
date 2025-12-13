const fs = require('fs');
const https = require('https');

const API_KEY = "AIzaSyAyS7xDN4gzycg7IP5A-ipCPJxWpuB62Ic";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            let output = "";
            if (json.models) {
                output += "Available Models:\n";
                json.models.forEach(m => output += m.name + "\n");
            } else {
                output += "No models found or error:\n" + JSON.stringify(json, null, 2);
            }
            fs.writeFileSync('models_list.txt', output);
            console.log("Written to models_list.txt");
        } catch (e) {
            console.error("Error parsing JSON:", e);
            console.log("Raw data:", data);
        }
    });
}).on('error', (e) => {
    console.error("Error fetching models:", e);
});
