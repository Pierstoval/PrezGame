const spawn = require('child_process').spawn;
const http = require('http');
const httpProxy = require('http-proxy');
const socketio = require('socket.io');
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
const socket      = socketio(httpServer);
let hostingSocket = null;
const sessionData = {};

socket.on('connection', function(socket){
    log('ws', 'A user connected');

    sessionData[socket.id] = {};

    socket.on('subscribe', function() {
        if (hostingSocket) {
            socket.emit('message', 'Il y a déjà un hôte pour cette présentation !');
            return;
        }
        log('ws', 'Presentation host connected!');
        hostingSocket = socket;
    });

    socket.on('message', function(msg) {
        if (hostingSocket === null) {
            socket.emit('message', 'Attendez que l\'hôte ait créé une session de présentation, ne soyez pas trop pressé•e :)');
            return;
        }
        log('ws', `WS message:\t${msg}`);
        hostingSocket.emit('message', 'Someone helped you!');
    });
});

socket.on('disconnect', function(socket){
    log('ws', 'Disconnect');
    if (hostingSocket && socket.id === hostingSocket.id) {
        hostingSocket = null;
        log('ws', 'Presentation host disconnected.');
    }
});
/** **************** **/

function log(type, message) {
    let date = (new Date()).toISOString().replace(/[TZ]/gi, ' ').trim();
    process.stdout.write(`[${date}] [${type}] ${message}\n`);
}
