(function(w, d){
    var messageBlock = d.getElementById('messages');

    function message(msg, waitAndDelete){
        if (typeof waitAndDelete === 'undefined') {
            waitAndDelete = true;
        }
        if (!messageBlock) {
            console.error('Cannot write a message, element "#messages" doesn\'t exist');
            return;
        }

        var element = document.createElement('p');
        element.innerHTML = msg;
        messageBlock.appendChild(element);

        if (waitAndDelete) {
            setTimeout(function(){
                messageBlock.removeChild(element);
            }, 5000);
        } else {
            var a = document.createElement('a');
            a.href = 'javascript:void(0);';
            a.innerHTML = '&times;';
            element.prepend(a);
            a.addEventListener('click', function(e) {
                messageBlock.removeChild(element);
                e.preventDefault();
                return false;
            });
        }
    }

    function initPresentation(d) {
        if (!Reveal || !io || !w.SOCKET_URL) {
            throw 'This app needs Reveal and socket.io to be available.';
        }

        // In dev, allows resetting the list of asked help.
        localStorage.setItem('help', '');

        /**
         * Socket interactions
         */
        var socket = io.connect(w.SOCKET_URL);
        socket.emit('subscribe', 'login');
        socket.on('message', message);
        socket.on('broadcast', message);
        socket.on('stats', function(msg) {
            message('Stats: '+msg);
        });
        socket.on('coolSlide', function(nb){
            var cur = Reveal.getCurrentSlide();
            cur.setAttribute('data-cool', nb);
            cur.classList.add('show');
        });
        socket.on('helpSlide', function(nb){
            var cur = Reveal.getCurrentSlide();
            Reveal.getCurrentSlide().setAttribute('data-help', nb);
            cur.classList.add('show');
        });

        /**
         * Events based on sockets
         */
        Reveal.addEventListener('slidechanged', function () {
            socket.emit('update_slide', Reveal.getCurrentSlide().id);
        });

        d.addEventListener('keydown', function(event){
            if (event.keyCode === 71) {
                // key "g"
                socket.emit('stats');
            }
        });
    }

    function initButtonInteraction(d) {
        if (!io || !w.SOCKET_URL) {
            throw 'This app needs Reveal and socket.io to be available.';
        }

        var socket = io.connect(w.SOCKET_URL);
        d.getElementById('help-me').addEventListener('click', function(){
            var helped = localStorage.getItem('help') || [];
            socket.emit('help', JSON.stringify(helped) || []);
        });
        d.getElementById('cool').addEventListener('click', function(){
            var cooled = localStorage.getItem('cool') || [];
            socket.emit('cool', JSON.stringify(cooled) || []);
        });
        socket.on('helpReturn', function(slideName){
            var item = localStorage.getItem('help');
            var helped = (item ? item.split(',') : []) || [];
            helped.push(slideName);
            localStorage.setItem('help', helped.join(','));
        });
        socket.on('coolReturn', function(slideName){
            var item = localStorage.getItem('cool');
            var cooled = (item ? item.split(',') : []) || [];
            cooled.push(slideName);
            localStorage.setItem('cool', cooled.join(','));
        });
        socket.on('message', function(msg) {
            message(msg);
        });
    }

    w.initButtonInteraction = initButtonInteraction;
    w.initPresentation = initPresentation;
})(window, document);
