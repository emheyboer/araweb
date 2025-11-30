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

var cache = {}

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

async function streamFile(url) {
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

async function apiCall(endpoint, res) {
    const endpoints = {
        "/latest": () => {
            const query = database.prepare('select * from records order by date desc limit 2');
            const last_two = query.all();
            const latest_time = new Date(last_two[0].date);
            const prev_time = new Date(last_two[1].date);
            const interval = (latest_time - prev_time); // # time between readings
            const next_time = new Date(latest_time.getTime() + interval);
            let ttl = (next_time - new Date()) / 1000; // # of secs until the next update

            const cached_time = new Date(cache['/latest']?.value?.date);
            if (cached_time.getTime() == latest_time.getTime()) {
                // there should be new readings, but we don't have them yet so keep asking
                ttl = 1;
            }

            const value = last_two[0];
            return {value, ttl};
        },
        "/yesterday": () => {
            const date = new Date();
            date.setDate(date.getDate() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select * from records where date < '${iso}' order by date desc limit 1`);
            const value = query.all()[0];
            return {value, ttl: 60};
        },
        "/lastmonth": () => {
            const date = new Date();
            date.setMonth(date.getMonth() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select * from records where date < '${iso}' order by date desc limit 1`);
            const value = query.all()[0];
            return {value, ttl: 60};
            },
        "/lastyear": () => {
            const date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            const iso = date.toISOString();

            const query = database.prepare(`select * from records where date < '${iso}' order by date desc limit 1`);
            const value = query.all()[0];
            return {value, ttl: 60};
        },
        "/outside": async () => {
            const value = await fetchOutdoorReadings();
            return {value, ttl: 60};
        },
        "/max": () => {
            const query = database.prepare(`select max(co2) as co2, max(temperature) as temperature,
                max(humidity) as humidity, max(pressure) as pressure from records`);
            const value = query.all()[0];
            return {value, ttl: 60};
        },
        "/min": () => {
            const query = database.prepare(`select min(co2) as co2, min(temperature) as temperature,
                min(humidity) as humidity, min(pressure) as pressure from records`);
            const value = query.all()[0];
            return {value, ttl: 60};
        },
        "/avg": () => {
            const value = avgOverPeriod();
            return {value, ttl: 60};
        },
        "/avgtoday": () => {
            const start = new Date();
            start.setHours(0);
            start.setMinutes(0);
            start.setMilliseconds(0);

            const value = avgOverPeriod(start);
            return {value, ttl: 60};
        },
        "/avgyesterday": () => {
            const start = new Date();
            start.setDate(start.getDate() - 1);
            start.setHours(0);
            start.setMinutes(0);
            start.setMilliseconds(0);

            const end = new Date();
            end.setHours(0);
            end.setMinutes(0);
            end.setMilliseconds(0);

            const value = avgOverPeriod(start, end);
            return {value, ttl: 60};
        },
        "/avgmonth": () => {
            const start = new Date();
            start.setDate(1);
            start.setHours(0);
            start.setMinutes(0);
            start.setMilliseconds(0);

            const value = avgOverPeriod(start);
            return {value, ttl: 60};
        },
        "/avgyear": () => {
            const start = new Date();
            start.setDate(1);
            start.setMonth(0);
            start.setHours(0);
            start.setMinutes(0);
            start.setMilliseconds(0);

            const value = avgOverPeriod(start);
            return {value, ttl: 60};
        },
    }

    if (endpoints[endpoint]) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');

        if (!cache[endpoint] || cache[endpoint].expires < new Date()) {
            const json = await endpoints[endpoint](res);
            cache[endpoint] = {
                'expires': new Date(new Date().getTime() + json.ttl * 1000),
                'value': json.value,
            }
        }
        const entry = cache[endpoint];
        res.end(`${JSON.stringify(entry, null, 2)}`);
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

async function fetchOutdoorReadings() {
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

function avgOverPeriod(start, end) {
    let query_str = `select avg(co2) as co2, avg(temperature) as temperature,
        avg(humidity) as humidity, avg(pressure) as pressure from records`;
    if (start || end) {
        query_str += ' where';
    }
    if (start) {
        query_str += ` date > '${start.toISOString()}'`;
    }
    if (end) {
        if (start) {
            query_str += ' and';
        }
        query_str += ` date < '${end.toISOString()}'`;
    }
    const query = database.prepare(query_str);
    const value = query.all()[0];
    return value;
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