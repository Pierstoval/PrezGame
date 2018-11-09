const spawn = require('child_process').spawn;
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');
const dateFormat = require('dateformat');

if (process.env.NODE_ENV !== 'production') {
    log('process', 'Starting Gulp process');
    const gulpscript = spawn('node', ['./node_modules/gulp4/bin/gulp', 'watch'], {stdio: 'inherit'});
    const exitGulp = () => {
        log('process', 'Exiting Gulp process');
        gulpscript.stdin.pause();
        gulpscript.kill('SIGINT');
    };
    process.on('exit', exitGulp);
    process.on('beforeExit', exitGulp);
    process.on('disconnect', exitGulp);
}

/** HTTP server**/
const httpServer = http.createServer();
httpServer.listen(process.env.PORT || 8080);
/** ***************** **/


/** Websocket server **/
const io = socketio(httpServer);
let hostingSocket = null;
let currentSlide = null;
const sessionData = {
    date: dateFormat(new Date(), 'yyyy-mm-dd HH-MM-ss'),
    sessions: {}
};
let connected = 0;

setInterval(() => {
    let stats = getStats();
    let fileName = __dirname+'/var/presentations/'+sessionData.date.replace(' ', '_')+'_stats.json';

    fs.writeFile(fileName, JSON.stringify(stats, null, 4), function(err){
        if (err) {
            throw err;
        }
        log('log', `Saved presentation stats in ${fileName}`);
    });
}, 2000);

io.on('connection', function(socket){
    connected++;
    log('ws', `A user connected! Now there are ${connected} users.`);
    if (hostingSocket) {
        hostingSocket.emit('message', `Une personne supplémentaire ! Il y a maintenant ${connected} personnes connectées !.`);
    }

    updatePresentationSession();

    sessionData.sessions[socket.id] = {
        host: false,
        helpWantedForSlides: [],
        coolSlides: []
    };

    /**
     * HOST socket interactions
     */
    socket.on('subscribe', function(message) {
        if (hostingSocket) {
            socket.emit('message', 'Il y a déjà un hôte pour cette présentation ! Les interactions ne fonctionneront pas pour vous !');
            return;
        }
        if (message !== 'login') {
            socket.emit('message', 'Tu te paies ma tête ou quoi ?');
            return;
        }
        log('ws', 'L\'hôte est connecté!');
        socket.emit('message', 'Vous êtes bien l\'hôte de la présentation ☺');
        hostingSocket = socket;
        sessionData.sessions[socket.id].host = true;
        updatePresentationSession();
    });

    socket.on('update_slide', function(slideName) {
        log('ws', `Slide changed to ${slideName}`);
        if (!hostingSocket || hostingSocket.id !== socket.id) {
            socket.emit('message', 'Seul l\'hôte peut utiliser cet évènement :D');
            return;
        }
        currentSlide = slideName;
        updatePresentationSession();
    });

    /**
     * VISITOR socket interactions
     */
    socket.on('help', function (msg) {
        msg = msg.replace(/^"|"$/gi, '');
        msg = (msg ? msg.split(',') : []) || [];
        if (hostingSocket === null || currentSlide === null) {
            socket.emit('message', 'Attendez que l\'hôte ait créé démarré la présentation, ne soyez pas trop pressé•e :)');
            return;
        }
        if (hostingSocket.id === socket.id) {
            socket.emit('message', 'Hey, vous ne pensiez tout de même pas vous aider vous-même ? :D');
            return;
        }

        let alreadyAsked = msg.find(function (element) {
            return currentSlide === element;
        });

        let found = sessionData.sessions[socket.id].helpWantedForSlides.find(function (element) {
            return currentSlide === element;
        });

        if (found || alreadyAsked) {
            socket.emit('message', 'Vous avez déjà demandé de l\'aide pour ce sujet…');
        } else {
            sessionData.sessions[socket.id].helpWantedForSlides.push(currentSlide);
            let nb = personWhoDidNotUnderstand();
            let message = 'Uh ?';
            switch (nb) {
                case 0:
                    message = 'Tout le monde a compris ♥ (même si je n\'y crois pas…)';
                    break;
                case 1:
                    message = 'Quelqu\'un n\'a pas compris…';
                    break;
                default:
                    message = `${nb} personnes n'ont pas compris…`;
                    break;
            }
            hostingSocket.emit('message', message);
            hostingSocket.emit('helpSlide', nb);
            socket.emit('helpReturn', currentSlide);
            updatePresentationSession();
        }
    });

    socket.on('cool', function (msg) {
        msg = msg.replace(/^"|"$/gi, '');
        msg = (msg ? msg.split(',') : []) || [];
        if (hostingSocket === null || currentSlide === null) {
            socket.emit('message', 'Attendez que l\'hôte ait créé démarré la présentation, ne soyez pas trop pressé•e :)');
            return;
        }
        if (hostingSocket.id === socket.id) {
            socket.emit('message', 'Trop de coolitude tue la coolitude B-)🕶️🕶️');
            return;
        }

        let alreadyAsked = msg.find(function (element) {
            return currentSlide === element;
        });

        let found = sessionData.sessions[socket.id].coolSlides.find(function (element) {
            return currentSlide === element;
        });

        if (found || alreadyAsked) {
            socket.emit('message', 'Oui, on le sait, c\'est cool :D');
        } else {
            sessionData.sessions[socket.id].coolSlides.push(currentSlide);
            let nb = personWhoFindThisCool();
            let message = 'Uh ?';
            switch (nb) {
                case 0:
                    message = 'Personne ne trouve ça cool :\'(';
                    break;
                case 1:
                    message = 'Quelqu\'un trouve ça cool !';
                    break;
                default:
                    message = `${nb} personnes trouvent ça cool \\o/`;
                    break;
            }
            hostingSocket.emit('message', message);
            hostingSocket.emit('coolSlide', nb);
            socket.emit('coolReturn', currentSlide);
            updatePresentationSession();
        }
    });

    /**
     * Global socket interactions
     */
    socket.on('stats', async function() {
        log('ws', `Seeking for statistics`);

        socket.emit('stats', getFormattedStats());
    });

    socket.on('disconnect', function(){
        connected--;
        log('ws', 'Disconnect');
        if (hostingSocket && socket.id === hostingSocket.id) {
            hostingSocket = null;
            log('ws', 'Presentation host disconnected.');
        }
        updatePresentationSession();
    });
});

/** **************** **/

function log(type, message) {
    let date = dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss');
    process.stdout.write(`[${date}] [${type}] ${message}\n`);
}

function updatePresentationSession() {
    let fileName = __dirname+'/var/presentations/'+sessionData.date.replace(' ', '_')+'.json';
    fs.writeFile(fileName, JSON.stringify(sessionData, null, 4), function(err){
        if (err) {
            throw err;
        }
        log('log', `Saved presentation in ${fileName}`);
    });
}

function personWhoDidNotUnderstand() {
    if (!currentSlide) {
        return 0;
    }

    let number = 0;

    Object.keys(sessionData.sessions).forEach(function (socketId) {
        let found = sessionData.sessions[socketId].helpWantedForSlides.find(function(element){
            return element === currentSlide;
        });
        if (found) {
            number++;
        }
    });

    return number;
}

function personWhoFindThisCool() {
    if (!currentSlide) {
        return 0;
    }

    let number = 0;

    Object.keys(sessionData.sessions).forEach(function (socketId) {
        let found = sessionData.sessions[socketId].coolSlides.find(function(element){
            return element === currentSlide;
        });
        if (found) {
            number++;
        }
    });

    return number;
}

function getStats() {
    let stats = {
        help: {},
        cool: {},
    };

    Object.keys(sessionData.sessions).forEach(function (socketId) {
        let helpSlides = sessionData.sessions[socketId].helpWantedForSlides;
        let coolSlides = sessionData.sessions[socketId].coolSlides;

        helpSlides.forEach(function(e){
            if (!stats[e]) {
                stats.help[e] = 0;
            }
            stats.help[e] ++;
        });
        coolSlides.forEach(function(e){
            if (!stats[e]) {
                stats.cool[e] = 0;
            }
            stats.cool[e] ++;
        });
    });

    return stats;
}

function getFormattedStats() {
    let stats = {};

    Object.keys(sessionData.sessions).forEach(function (socketId) {
        let helpSlides = sessionData.sessions[socketId].helpWantedForSlides;
        let coolSlides = sessionData.sessions[socketId].coolSlides;

        helpSlides.forEach(function(e){
            if (!stats[e]) {
                stats[e] = {help: 0, cool: 0};
            }
            stats[e].help ++;
        });
        coolSlides.forEach(function(e){
            if (!stats[e]) {
                stats[e] = {help: 0, cool: 0};
            }
            stats[e].cool ++;
        });
    });

    let formattedStats = '';

    Object.keys(stats).forEach((slideName) => {
        formattedStats += slideName + ":&nbsp;"+stats[slideName].cool+"👍&nbsp;/&nbsp;"+stats[slideName].help+"🤔<br>";
    });

    return formattedStats;
}
