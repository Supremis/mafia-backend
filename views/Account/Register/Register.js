window.addEventListener('load', function() {
    const button = document.querySelector('#register');

    const username = document.querySelector('#username');
    const email = document.querySelector('#email');
    const password = document.querySelector('#password');

    username.addEventListener('keypress', (e) => { if (e.code == 'Enter') { button.click(); } });
    email.addEventListener('keypress', (e) => { if (e.code == 'Enter') { button.click(); } });
    password.addEventListener('keypress', (e) => { if (e.code == 'Enter') { button.click(); } });

    button.addEventListener('click', function() {
        fetch('http://localhost:3000/account/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.value, email: email.value, password: password.value })
        })
            .then(async response => {
                const data = await response.text();
                alert(data);
                if (response.ok) window.location.href = 'http://localhost:3000/login';
            });
    });
});