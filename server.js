#!/usr/bin/env node
const { DatabaseSync } = require('node:sqlite');
const http = require('http');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ quiet: true });

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
    if (req.url.startsWith('/api/v1')) {
        const endpoint = req.url.slice(7);
        await apiCall(endpoint, res);
    } else if (req.url.startsWith('/api')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`available versions:\n/v1`);   
    } else {
        const file = await streamFile(req.url);
        if (!file.found) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Page Not Found');
        } else {
            res.statusCode = 200;
            res.setHeader("Content-Type", file.mime_type);
            file.stream.pipe(res);
        }
    }
});

const streamFile = async function(url) {
    const mime_types = {
        default: "application/octet-stream",
        html: "text/html; charset=UTF-8",
        js: "text/javascript",
        css: "text/css",
        png: "image/png",
        jpg: "image/jpeg",
        gif: "image/gif",
        ico: "image/x-icon",
        svg: "image/svg+xml",
    };

    const paths = ['./public', url];
    if (url.endsWith("/")) {
        paths.push("index.html");
    }
    const file_path = path.join(...paths);

    const to_bool = [() => true, () => false];
    const found = file_path.startsWith('public') && await fs.promises.access(file_path).then(...to_bool);
    if (!found) {
        return { found };
    }

    const extension = path.extname(file_path).substring(1).toLowerCase();
    const mime_type = mime_types[extension] || mime_types['default'];
    const stream = fs.createReadStream(file_path);
    return { found, mime_type, stream };
};

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
        "/max": () => {
            const query = database.prepare(`select max(co2) as co2, max(temperature) as temperature,
                max(humidity) as humidity, max(pressure) as pressure from records`);
            const results = query.all();
            return results[0];
        },
        "/min": () => {
            const query = database.prepare(`select min(co2) as co2, min(temperature) as temperature,
                min(humidity) as humidity, min(pressure) as pressure from records`);
            const results = query.all();
            return results[0];
        },
        "/avg": () => {
            const date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select avg(co2) as co2, avg(temperature) as temperature,
                avg(humidity) as humidity, avg(pressure) as pressure from records`);
            const results = query.all();
            return results[0];
        },
    }

    if (endpoints[endpoint]) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        const json = await endpoints[endpoint](res);
        res.end(`${JSON.stringify(json, null, 2)}`);
    } else if (endpoint == '/' || endpoint == '') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`available endpoints:\n${Object.keys(endpoints).join('\n')}`);      
    } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`endpoint "${endpoint}" not found`);
    }
}

const fetchOutdoorReadings = async function() {
    const json = await retryFetch(weatherApi).then(r => r.json());

    const readings = {
        'date': new Date(json['dt'] * 1000).toISOString(),
        'co2': 440,
        'temperature': json['main']['temp'],
        'pressure': json['main']['pressure'],
        'humidity': json['main']['humidity'],
    }

    return readings;
}

function retryFetch(resource, options, backoff = 500) {
    function wait(delay){
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
    function onError(_err){
        return wait(backoff).then(() => retryFetch(resource, options, backoff * 2));
    }
    return fetch(resource, options).catch(onError);
}

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});