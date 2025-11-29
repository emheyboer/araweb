const api_url = `${location.protocol}//${location.hostname}:${Number(location.port) + 1}/api/v1`;

async function update() {
    const output = document.getElementById('output');

    const cards = [
        ['right now', '/latest'],
        ['outside right now', '/outside'],
        ['yesterday', '/yesterday'],
        ['one month ago', '/lastmonth'],
        ['one year ago', '/lastyear'],
    ];

    let html = ''
    for (let i = 0; i < cards.length; i++) {
        const [title, endpoint] = cards[i];
        const reading = await fetch(`${api_url}${endpoint}`).then(res => res.json());
        html += formatReading(title, reading);
    }

    output.innerHTML = html;
}

function formatReading(title, reading) {
    result = '<div class="reading">';
    result += `<span id="${title}">${title}</span>`
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

    result += '</div>';
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

update()
window.setInterval(update, 1000)