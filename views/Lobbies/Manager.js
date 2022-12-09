const fs = require('fs');

module.exports = {
    List: fs.readFileSync(`${__dirname}/List/List.html`, 'utf8'),
    Lobby: fs.readFileSync(`${__dirname}/Lobby/Lobby.html`, 'utf8'),
};