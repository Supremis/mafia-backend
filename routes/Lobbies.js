const { Router } = require('express');
const { Users, Lobbies } = require('../db/Models');
const { WebSocketServer } = require('../server/Base');
const { List, Lobby } = require('../views/Lobbies/Manager');
const Validator = require('../engine/setups/Validator');
const crypto = require('crypto');
const { readFileSync } = require('fs');

const LobbyRouter = Router();
const Timeouts = {};

LobbyRouter.route('/')
    .get(async (_, response) => {
        response.send(List);
    });

LobbyRouter.route('/pages')
    .get(async (_, response) => {
        const lobbies = await Lobbies.find();
        const pages = Math.ceil(lobbies.length / 10);
        response.status(200).send((pages == 0 ? 0 : pages - 1).toString());
    });

LobbyRouter.route('/find')
    .post(async (request, response) => {
        const page = request.body.page || 0;

        let _lobbies = await Lobbies.find();
        let lobbies = JSON.parse(JSON.stringify(_lobbies));

        if (typeof page != 'number') return response.status(400).send('Invalid page count.');

        lobbies = lobbies.reverse();

        let lobbiesSpliced = [];
        while (lobbies.length) {
            lobbiesSpliced.push(lobbies.splice(0, 10));
        }
        lobbiesSpliced = lobbiesSpliced.reverse();
        lobbiesSpliced.forEach(lobbies => {
            lobbies.forEach(l => {
                delete l.messages;
                delete l._id;
                l.players.current.forEach(player => {                    
                    delete player.role;
                    delete player.dead;
                    delete player.item;
                    delete player.didAction;
                });
            });
        });

        if (!lobbiesSpliced[0] && page == 0) return response.status(200).json([]);
        if (!Array.isArray(lobbiesSpliced[page])) return response.status(400).send(`Page must be within bounds 0-${lobbiesSpliced.length}.`);
        response.status(200).json(...lobbiesSpliced);
    });

LobbyRouter.route('/create')
    .post(async (request, response) => {
        const users = await Users.find();

        let { token, setup, ranked } = request.body;

        if (typeof Validator(setup) == 'string') return response.status(400).send(Validator(setup));
        const userData = users.find(user => user.token == token);
        if (!userData) return response.status(401).send('Invalid token.');
        if (userData.activeGames.length) return response.status(403).send('You are already in a game.');
        if (typeof ranked != 'boolean') ranked = true;

        const user = await Users.findById(userData._id);
        const lobbyID = crypto.randomBytes(16).toString('hex');

        const lobby = new Lobbies({
            id: lobbyID,
            setup,
            players: {
                current: [{
                    username: userData.username,
                    avatar: userData.avatar,
                    role: '',
                    dead: false,
                    item: null,
                    didAction: [],
                }],
                required: setup.roles.length,
            },
            creator: userData.username,
            phase: 'Waiting...',
            ranked,
            started: false,
            votes: [],
        });
        lobby.save()
            .then(() => {
                user.activeGames.push(lobbyID);
                user.save()
                    .then(() => { response.status(200).send(lobbyID) })
                    .catch(() => { response.status(500).send('Could not join lobby.'); });
            })
            .catch((err) => { response.status(500).send('Could not create lobby. Error: ' + err); });
    });
    
LobbyRouter.route('/join')
    .post(async (request, response) => {
        const users = await Users.find();
        const lobbies = await Lobbies.find();

        const { token, id } = request.body;

        const userData = users.find(user => user.token == token);
        if (!userData) return response.status(401).send('Invalid token.');
        if (userData.activeGames.length) return response.status(403).send('You are already in a game.');

        const user = await Users.findById(userData._id);

        const lobbyData = lobbies.find(lobby => lobby.id == id);
        if (!lobbyData) return response.status(400).send('Invalid Lobby ID.');
        // if (lobbyData.started) return response.status(400).send('This game has already started!');
        if (lobbyData.players.current.length >= lobbyData.players.required/* || lobbyData.started*/) return response.status(400).send('Lobby is filled.');
        const lobby = await Lobbies.findOne({ _id: lobbyData._id, });

        lobby.players.current.push({ username: userData.username, avatar: userData.avatar, role: '', dead: false, item: null, didAction: [], });

        if (lobby.players.current.length >= lobby.players.required) {
            lobby.phase = 'Starting...';
            WebSocketServer.brodcast(JSON.stringify({
                header: 'GAME_PHASE',
                lobby: lobbyData.id,
                phase: lobby.phase,
            }), client => client.session.activeGames.includes(lobbyData.id) || client.session.token == token);

            Timeouts[lobbyData.id] = setTimeout(() => {
                lobby.started = true;

                lobby.phase = lobby.setup.phase.toLowerCase() == 'night' ? 'Night 1' : 'Day 1';
                WebSocketServer.brodcast(JSON.stringify({
                    header: 'GAME_PHASE',
                    lobby: lobbyData.id,
                    phase: lobby.phase,
                }), client => client.session.activeGames.includes(lobbyData.id));

                lobby.save()
                    .then(() => require(`../engine/game/${lobby.phase.split(' ')[0]}`)(WebSocketServer, lobbyData, true))
                    .catch(er => console.error('Error when saving Lobby data:', er));

                delete Timeouts[lobbyData.id];
            }, 10000);
        }

        lobby.save()
            .then(() => {
                user.activeGames.push(lobbyData.id);
                user.save()
                    .then(() => { 
                        WebSocketServer.brodcast(JSON.stringify({
                            header: 'PLAYERS',
                            lobby: lobbyData.id,
                            userList: lobby.players.current,
                            suicide: false,
                        }), client => client.session.activeGames.includes(lobbyData.id));

                        response.status(200).send('Successfully joined lobby.'); 
                    })
                    .catch(() => { response.status(500).send('Could not join lobby.'); });
            })
            .catch(() => { response.status(500).send('Could not join lobby.'); });
    });

LobbyRouter.route('/leave')
    .post(async (request, response) => {
        const users = await Users.find();
        const lobbies = await Lobbies.find();

        const { token, id } = request.body;
        
        const userData = users.find(user => user.token == token);
        if (!userData) return response.status(401).send('Invalid token.');
        if (!userData.activeGames.length) return response.status(400).send('You are not in a game.');

        const user = await Users.findById(userData._id);

        const lobbyData = lobbies.find(lobby => lobby.id == id);
        if (!lobbyData) return response.status(400).send('Invalid Lobby ID.');
        const lobby = await Lobbies.findOne({ _id: lobbyData._id, });

        const playerIndex = lobby.players.current.findIndex(object => object.username == userData.username);
        if (playerIndex == -1) return response.status(500).send('Could not find you within the game.');

        lobby.players.current.splice(playerIndex, 1);

        let suicide = false;
        if (lobby.phase.toLowerCase().includes('day') || lobby.phase.toLowerCase().includes('night')) {
            lobby.ranked = false;
            suicide = true;
        }

        if (lobby.players.current.length == 0) {
            Lobbies.deleteOne({ _id: lobbyData._id })
                .then(() =>  {
                    user.activeGames = [];
                    user.save()
                        .then(() => response.status(200).send('Successfully left lobby.'))
                        .catch(err => response.status(500).send('Could not leave lobby. Error: ' + err))
                })
                .catch(err => response.status(500).send('Could not leave lobby. Error: ' + err));
        } else {
            lobby.save()
                .then(() => {
                    user.activeGames = [];
                    user.save()
                        .then(() => { 
                            WebSocketServer.brodcast(JSON.stringify({
                                header: 'PLAYERS',
                                lobby: lobbyData.id,
                                userList: lobby.players.current,
                                suicide,
                            }), client => client.session.activeGames.includes(lobbyData.id));

                            response.status(200).send('Successfully left lobby.'); 
                        })
                        .catch((err) => { response.status(500).send('Could not leave lobby. Error: ' + err); });
                    })
                .catch((err) => { response.status(500).send('Could not leave lobby. Error: ' + err); });
        }
    });

LobbyRouter.route('/:id')
    .get(async (request, response) => {
        const id = request.params.id;
        const lobby = await Lobbies.findOne({ id, });

        if (!lobby) return response.status(400).send('Lobby ID is not valid.');

        response.send(Lobby);
    });

module.exports = { LobbyRouter };