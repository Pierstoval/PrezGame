const spawn = require('child_process').spawn;
const http = require('http');
const httpProxy = require('http-proxy');
const socketio = require('socket.io');
const fs = require('fs');
const dateFormat = require('dateformat');
const envToShare = {
    'APP_ENV': process.env.APP_ENV || '',
    'APP_SECRET': process.env.APP_SECRET || '',
};

console.info('envToShare', envToShare);

/** PHP SCRIPT **/
spawn('php', ['bin/console', 'server:run', '9999', '-vvv', '--no-ansi'], {stdio: 'inherit', env: process.env});
/** ********** **/


/** HTTP Proxy to PHP **/
var proxy = httpProxy.createProxyServer({});
const httpServer = http.createServer(function(req, res) {
    proxy.web(req, res, {target: 'http://127.0.0.1:9999'});
}).listen(process.env.PORT || 80);
/** ***************** **/


/** Websocket server **/
const io = socketio(httpServer);
let hostingSocket = null;
let currentSlide = null;
const sessionData = {
    date: dateFormat(new Date(), 'yyyy-mm-dd HH-MM-ss'),
    sessions: {}
};

io.on('connection', function(socket){
    log('ws', 'A user connected');

    updatePresentationSession();

    sessionData.sessions[socket.id] = {
        host: false,
        helpWantedForSlides: []
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
        let referer = socket.request.headers['referer'];
        if (!referer.match(/\/presentation$/gi)) {
            socket.emit('message', 'Tu te paies VRAIMENT ma tête ou quoi ?');
            return;
        }
        log('ws', 'Presentation host connected!');
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
    socket.on('help', async function (msg) {
        msg = msg.replace(/^"|"$/gi, '');
        msg = (msg ? msg.split(',') : []) || [];
        if (hostingSocket === null || currentSlide === null) {
            socket.emit('message', 'Attendez que l\'hôte ait créé une session de présentation, ne soyez pas trop pressé•e :)');
            return;
        }
        if (hostingSocket.id === socket.id) {
            socket.emit('message', 'Hey, vous ne pensiez tout de même pas vous aider vous-même ? :D');
            return;
        }

        let alreadyAsked = await msg.find(function (element) {
            return currentSlide === element;
        });

        let found = await sessionData.sessions[socket.id].helpWantedForSlides.find(function (element) {
            return currentSlide === element;
        });

        if (found || alreadyAsked) {
            await socket.emit('message', 'Vous avez déjà demandé de l\'aide pour ce sujet…');
        } else {
            sessionData.sessions[socket.id].helpWantedForSlides.push(currentSlide);
            let nb = await personWhoDidNotUnderstand();
            let message = 'Uh ?';
            switch (nb) {
                case 0:
                    message = 'Tout le monde a compris ♥ (même si je n\'y crois pas…)'
                    break;
                case 1:
                    message = 'Quelqu\'un n\'a pas compris…';
                    break;
                default:
                    message = `${nb} personnes n'ont pas compris…`
                    break;
            }
            hostingSocket.emit('message', message);
            socket.emit('helpReturn', currentSlide);
            updatePresentationSession();
        }
    });

    /**
     * Global socket interactions
     */
    socket.on('stats', async function() {
        log('ws', `Seeking for statistics`);

        let stats = await getStats();

        socket.emit('stats', JSON.stringify(stats));
    });

    socket.on('disconnect', function(){
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

async function personWhoDidNotUnderstand() {
    if (!currentSlide) {
        return 0;
    }

    let number = 0;

    await Object.keys(sessionData.sessions).forEach(function (socketId) {
        let found = sessionData.sessions[socketId].helpWantedForSlides.find(function(element){
            return element === currentSlide;
        });
        if (found) {
            number++;
        }
    });

    return number;
}

async function getStats() {
    let stats = {};

    await Object.keys(sessionData.sessions).forEach(async function (socketId) {
        let slides = sessionData.sessions[socketId].helpWantedForSlides;

        await slides.forEach(function(e){
            if (!stats[e]) {
                stats[e] = 0;
            }
            stats[e] ++;
        });
    });

    return stats;
}
