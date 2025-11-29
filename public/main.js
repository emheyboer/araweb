const api_url = `${location.protocol}//${location.host}/api/v1`;

async function setup() {
    const output = document.getElementById('output');

    const cards = [
        ['right now', 'latest', '/latest'],
        ['outside', 'outside', '/outside'],
        ['average today', 'avgtoday', '/avgtoday'],
        ['average yesterday', 'avgyesterday', '/avgyesterday'],
        ['average this month', 'avgmonth', '/avgmonth'],
        ['average this year', 'avgyear', '/avgyear'],
        ['yesterday', 'yesterday', '/yesterday'],
        ['one month ago', 'lastmonth', '/lastmonth'],
        ['one year ago', 'lastyear', '/lastyear'],
        ['all-time average', 'avg', '/avg'],
        ['all-time highs', 'max', '/max'],
        ['all-time lows', 'min', '/min'],
    ];

    for (let i = 0; i < cards.length; i++) {
        const [title, id, endpoint] = cards[i];
        const card = new Card(title, id, endpoint)
        output.appendChild(card.html);
    }
}

class Card {
    constructor(title, id, endpoint) {
        this.title = title;
        this.id = id;
        this.endpoint = endpoint;

        this.initDiv();

        const keys = ['co2', 'temperature', 'humidity', 'pressure'];
        this.initRows(keys);

        this.update();
    }

    initDiv() {
        this.outer = document.createElement('div');
        this.outer.id = this.id;
        this.outer.classList.add('card-outer');

        this.inner = document.createElement('div');
        this.inner.id = `${this.id}-inner`;
        this.inner.classList.add('card-inner');
        this.outer.appendChild(this.inner);

        const span = document.createElement('span');
        span.id = `${this.id}-title`;
        span.innerText = this.title;
        span.classList.add('title');
        this.inner.appendChild(span);

        if (this.id == 'latest') {
            this.age = document.createElement('span');
            this.age.id = 'age';
            span.appendChild(this.age);
            this.update_age();
        }
    }

    initRows(keys) {
        this.rows = [];
        keys.forEach(key => {
            const span = document.createElement('span');
            span.id = `${this.id}-${key}`;
            span.classList.add('row', key);
            this.rows.push({ key, span });
            this.inner.appendChild(span);
        })
    }

    get html() {
        return this.outer;
    }

    async update_age() {
        if (this.reading) {
            const delta = new Date() - new Date(this.reading.date)
            const secs = Math.round(delta / 1000);
            this.age.innerText = ` (${secs}s)`;
        } else {
            this.age.innerText = ``;
        }

        setTimeout(() => {
            this.update_age();
        }, 1000);
    }

    async update() {
        const entry = await retryFetch(`${api_url}${this.endpoint}`).then(res => res.json());
        const ttl = new Date(entry.expires) - new Date();
        this.reading = entry.value;

        this.rows.forEach(row => {
            const newValue = formatValue(row.key, this.reading[row.key]);
            if (newValue != row.span.innerHTML) {
                row.span.innerHTML = newValue;
            }
        })

        setTimeout(() => {
            this.update();
        }, ttl);
    }
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

function formatValue(key, value) {
    let display = value.toLocaleString();
    switch (key) {
        case 'date':
            return null
        case 'co2':
            display = `<span style="color: ${co2Color(value)}">${Math.round(value).toLocaleString()}</span> ppm co2`;
            break;
        case 'temperature':
            const rounded = Number(value.toFixed(1))
            display = `${rounded.toLocaleString()}°F`;
            break;
        case 'humidity':
            display = `${Math.round(display)}% humidity`;
            break;
        case 'pressure':
            display = `${Math.round(value).toLocaleString()} hPa`;
            break;
    }
    return display;
}

function co2Color(co2) {
    if (co2 >= 1400) {
        return 'red';
    }
    if (co2 >= 1000) {
        return 'darkorange';
    }
    return 'green';
}

setup()