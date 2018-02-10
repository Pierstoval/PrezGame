const spawn = require('child_process').spawn;
const http = require('http');
const httpProxy = require('http-proxy');
const socketio = require('socket.io');
const envToShare = JSON.parse(JSON.stringify(process.env));

console.info('envToShare', envToShare);

/** PHP SCRIPT **/
const child = process.env.NODE_ENV === 'production'
    ? spawn('php', ['-S', '127.0.0.1:9999', '-t', 'public'], {env: envToShare})
    : spawn('php', ['bin/console', 'server:run', '9999', '-vvv', '--no-ansi'], {env: envToShare})
;
child.stdout.on('data', (out) => {process.stdout.write(`[PHP stdout] ${out}\n`)});
child.stderr.on('data', (out) => {process.stderr.write(`[PHP stderr] ${out}\n`)});
child.on('error', (out) => {process.stderr.write(`[PHP error] ${out}\n`)});
child.on('exit', (code, signal) => { process.stderr.write('[PHP] Exited with '+`code ${code} and signal ${signal}`); });
child.on('disconnect', () => { process.stdout.write('[PHP] Disconnected\n'); });
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
    process.stdout.write('a user connected\n');

    sessionData[socket.id] = {};

    socket.on('subscribe', function() {
        if (hostingSocket) {
            socket.emit('message', 'Il y a déjà un hôte pour cette présentation !');
            return;
        }
        process.stdout.write('Presentation host connected!');
        hostingSocket = socket;
    });

    socket.on('message', function(msg) {
        if (hostingSocket === null) {
            socket.emit('message', 'Attendez que l\'hôte ait créé une session de présentation, ne soyez pas trop pressé•e :)');
            return;
        }
        process.stdout.write(`A message!\n${msg}`);
        hostingSocket.emit('message', 'Someone helped you!');
    });
});

socket.on('disconnect', function(socket){
    process.stdout.write('Disconnect\n');
    if (hostingSocket && socket.id === hostingSocket.id) {
        hostingSocket = null;
        process.stdout.write('Presentation host disconnected.\n');
    }
});
/** **************** **/
