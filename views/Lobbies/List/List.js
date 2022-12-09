if (!window.localStorage.getItem('token')) {
    window.location.href = 'http://localhost:3000/login';
}

window.addEventListener('load', async function() {
    const createSetup = document.querySelector('#creategame');
    createSetup.addEventListener('click', function() {
        window.fetch('http://localhost:3000/lobbies/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: localStorage.getItem('token'),
                setup: { roles: ['Mafia', 'Roleblocker', 'Cop'], phase: 'Night' },
                ranked: true,
            }),
        })
            .then(async response => {
                const data = await response.text();

                switch (response.status) {
                    case 200: {
                        window.location.href = `http://localhost:3000/lobbies/${data}`;
                        break;
                    }
                    case 401: {
                        window.location.href = 'http://localhost:3000/account/login';
                        break;
                    }
                    default: {
                        alert(data);
                        break;
                    }
                }
            });
    });

    let response = await this.fetch('http://localhost:3000/lobbies/pages');
    let page = await response.text();
    page = parseInt(page);

    response = await this.fetch(`http://localhost:3000/lobbies/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, }),
    });
    const lobbies = await response.json();
    
    const row = document.querySelector('.row');
    const placeholder = document.querySelector('.placeholder');

    placeholder.remove();

    lobbies.map(lobby => {
        const column = document.createElement('div');
        column.className = 'column';

        const button = document.createElement('button');
        button.innerText = 'join';
        button.id = 'join';
        button.disabled = lobby.players.current.length == lobby.players.required;

        button.addEventListener('click', function() {
            window.fetch('http://localhost:3000/lobbies/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: window.localStorage.token,
                    id: lobby.id,
                }),
            })
                .then(async response => {
                    const data = await response.text();

                    switch (response.status) {
                        case 200: {
                            window.location.href = `http://localhost:3000/lobbies/${lobby.id}`;
                            break;
                        }
                        case 401: {
                            window.location.href = 'http://localhost:3000/account/login';
                            break;
                        }
                        default: {
                            alert(data);
                            break;
                        }
                    }
                });
        });

        const text = document.createTextNode(`        ${lobby.players.current.length}/${lobby.players.required}`);

        column.appendChild(button);
        column.appendChild(text);

        row.appendChild(column);
    });
});