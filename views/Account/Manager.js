const fs = require('fs');

module.exports = {
    Login: fs.readFileSync(`${__dirname}/Login/Login.html`, 'utf8'),
    Register: fs.readFileSync(`${__dirname}/Register/Register.html`, 'utf8'),
}