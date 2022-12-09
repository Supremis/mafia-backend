if (window.localStorage.getItem('token')) {
    window.location.href = 'http://localhost:3000/lobbies';
}

window.addEventListener('load', function() {
    const button = document.querySelector('#login');

    const email = document.querySelector('#email');
    const password = document.querySelector('#password');

w

    button.addEventListener('click', function() {
        fetch('http://localhost:3000/account/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value, password: password.value })
        })
            .then(async response => {
                const data = await response.text();
                if (!response.ok) return alert(data);

                window.localStorage.setItem('token', data);
                window.location.href = 'http://localhost:3000/lobbies';
            });
    });
});