if (!window.localStorage.getItem('token')) {
    window.location.href = 'http://localhost:3000/login';
}

window.addEventListener('load', function() {
    const chatbox = document.querySelector('#chatbox');
    const input = document.querySelector('#input');
    const button = document.querySelector('#send');

    input.addEventListener('keypress', (e) => { if (e.code == 'Enter') { button.click(); } });
    button.addEventListener('click', function() {
        socket.send(JSON.stringify({
            header: 'SEND_MESSAGE',
            message: input.value,
        }));
    });

    const socket = window.WebSocket(`ws://localhost:3000/?token=${this.localStorage.getItem('token')}`);

    socket.addEventListener('open', function() { console.log('Socket opened!') }); 
    socket.addEventListener('error', function() { console.error('Socket failed to open.') });
    socket.addEventListener('close', function() { console.warn('Socket closed prematurely.') });

    socket.addEventListener('message', function(data) {
        data = JSON.parse(data);

        if (['MESSAGE_REJECT', 'SYSTEM_MESSAGE'].includes(data.header)) {
            const message = data.header == 'SYSTEM_MESSAGE' ? data.message : data.data.message;

            const p = document.createElement('p');
            p.style.color = 'red';
            p.appendChild(document.createTextNode(message));

            chatbox.appendChild(p);
        } else {
            switch (data.header) {
                case 'AUTHORIZATION_INVALID': {
                    alert(data.message);
                    window.location.href = 'http://localhost:3000/login';

                    break;
                }
                case 'RECV_MESSAGE': {
                    const message = data.message;
                    
                    const p = document.createElement('p');
                    p.appendChild(document.createTextNode(message));
        
                    chatbox.appendChild(p);
                }
            }
        }
    });
});