const api_url = `${location.protocol}//${location.host}/api/v1`;

async function setup() {
    const output = document.getElementById('output');

    const cards = [
        ['right now', 'latest', '/latest'],
        ['outside right now', 'outside', '/outside'],
        ['yesterday', 'yesterday', '/yesterday'],
        ['one month ago', 'lastmonth', '/lastmonth'],
        ['one year ago', 'lastyear', '/lastyear'],
    ];

    for (let i = 0; i < cards.length; i++) {
        const [title, id, endpoint] = cards[i];
        const card = new Card(title, id, endpoint)
        output.appendChild(card.div);
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
        this.div = document.createElement('div');
        this.div.id = this.id;
        this.div.classList.add('card');

        const span = document.createElement('span');
        span.id = `${this.id}-title`;
        span.innerText = this.title;
        this.div.appendChild(span);
        span.classList.add('title');
    }

    initRows(keys) {
        this.rows = [];
        keys.forEach(key => {
            const span = document.createElement('span');
            span.id = `${this.id}-${key}`;
            span.classList.add('row', key);
            this.rows.push({ key, span });
            this.div.appendChild(span);
        })
    }

    async update() {
        const reading = await retryFetch(`${api_url}${this.endpoint}`).then(res => res.json());

        this.rows.forEach(row => {
            const newValue = formatValue(row.key, reading[row.key]);
            if (newValue != row.span.innerHTML) {
                row.span.innerHTML = newValue;
            }
        })

        setTimeout(() => {
            this.update();
        }, 1000);
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
            display = new Date(value).toLocaleString();
            return;
        case 'co2':
            display = `<span style="color: ${co2Color(value)}">${display}</span> ppm co2`;
            break;
        case 'temperature':
            display = `${display}°F`;
            break;
        case 'humidity':
            display = `${display}% humidity`;
            break;
        case 'pressure':
            display = `${display} hPa`;
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