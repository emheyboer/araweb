const api_url = `${location.protocol}//${location.host}/api/v1`;

async function setup() {
    const output = document.getElementById('output');

    const cards = [
        ['right now', '/latest'],
        ['outside right now', '/outside'],
        ['yesterday', '/yesterday'],
        ['one month ago', '/lastmonth'],
        ['one year ago', '/lastyear'],
    ];

    for (let i = 0; i < cards.length; i++) {
        const [title, endpoint] = cards[i];
        const card = newCard(title, endpoint);
        output.appendChild(card);
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

function newCard(title, endpoint) {
    const card = document.createElement('div');
    card.id = `${title}-card`;
    card.classList.add('card');
    const update = async () => {
        const reading = await retryFetch(`${api_url}${endpoint}`).then(res => res.json());
        card.innerHTML = formatReading(title, reading);
    }
    update();
    setInterval(update, 1000);
    return card;
}

function formatReading(title, reading) {
    result = `<span id="${title}-title">${title}</span>`;
    Object.entries(reading).forEach(([key, value]) => {
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

        result += `<span id="${title}-${key}">${display}</span>`
    });
    return result;
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