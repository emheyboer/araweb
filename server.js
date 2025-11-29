#!/usr/bin/env node
const { DatabaseSync } = require('node:sqlite');
const http = require('http');
require('dotenv').config();

const database = new DatabaseSync(process.env.SQLITE_DB);
const hostname = process.env.HOSTNAME;
const port = process.env.PORT;
const weatherApi = `${process.env.WEATHER_API_URL}?lat=${
    process.env.LAT}&lon=${process.env.LONG}&appid=${process.env.WEATHER_API_KEY}&units=imperial`

var cache = {
    'outside': {
        'from': new Date(0),
    }
}

const server = http.createServer(async function(req, res) {
    if (req.url === '/') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('hi, this is the homepage :)');
    } else if (req.url.startsWith('/api/v1')) {
        const endpoint = req.url.slice(7);
        await apiCall(endpoint, res);
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Page Not Found');
    }
});

const apiCall = async function(endpoint, res) {
    res.setHeader('Access-Control-Allow-Origin', `http://${hostname}:8080`);

    const endpoints = {
        "/latest": () => {
            const query = database.prepare('select * from records order by date desc limit 1');
            const results = query.all();
            return results[0];
        },
        "/yesterday": () => {
            const date = new Date();
            date.setDate(date.getDate() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select * from records where date < '${iso}' order by date desc limit 1`);
            const results = query.all();
            return results[0];
        },
        "/lastmonth": () => {
            const date = new Date();
            date.setMonth(date.getMonth() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select * from records where date < '${iso}' order by date desc limit 1`);
            const results = query.all();
            return results[0];
            },
        "/lastyear": () => {
            const date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select * from records where date < '${iso}' order by date desc limit 1`);
            const results = query.all();
            return results[0];
        },
        "/outside": async () => {
            const now = new Date();
            let readings = cache['outside']['value'];
            if (now - cache['outside']['from'] > 60*1000) {
                readings = await fetchOutdoorReadings();
                cache['outside']['value'] = readings;
                cache['outside']['from'] = new Date();
            }
            return readings;
        },
    }

    if (endpoints[endpoint]) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        const json = await endpoints[endpoint](res);
        res.end(`${JSON.stringify(json, null, 2)}`);
    } else if (endpoint == '/') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`available endpoints:\n${Object.keys(endpoints).join('\n')}`);      
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`endpoint "${endpoint}" not found`);
    }
}

async function fetchOutdoorReadings() {
    const json = await fetch(weatherApi).then(r => r.json());

    const readings = {
        'date': new Date(json['dt'] * 1000).toISOString(),
        'co2': 440,
        'temperature': json['main']['temp'],
        'pressure': json['main']['pressure'],
        'humidity': json['main']['humidity'],
    }

    return readings;
}

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});