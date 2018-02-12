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

    var autoSlide = 10000;
    var internalTimer = autoSlide;
    var timerStartedAt = Date.now();
    var amount = 0;
    var pause = false;
    function initPresentation(d) {

        // In dev, allows resetting the list of asked help.
        localStorage.setItem('help', '');

        /**
         * Events
         */
        Reveal.addEventListener('slidechanged', function () {
            internalTimer = autoSlide;
            timerStartedAt = Date.now();
            updateSlide();
        });

        d.addEventListener('keydown', function(event){
            if (event.keyCode === 65) {
                // key "a"
                pause = !pause;
                console.info(pause ? 'Pause !' : 'Reprise');
            } else if (event.keyCode === 71) {
                // key "g"
                socket.emit('stats');
            }
        });

        /**
         * Socket interactions
         */
        var socket = io.connect(window.location.protocol+'//'+window.location.hostname);
        socket.emit('subscribe', 'login');
        socket.on('message', function(msg) {
            message(msg);
        });
        socket.on('stats', function(msg) {
            message('Stats: '+msg, false);
        });

        /**
         * Timer
         *
        setInterval(function(){
            ajax('GET', '{{ path('check_session_slide') }}', '', function(response){
                timerStartedAt = parseInt(timerStartedAt, 10);
                amount = (-1) * parseInt(response, 10);
                console.info(amount);
            });
        }, 500);
        setInterval(function(){
            if (pause) {
                return;
            }
            internalTimer -= 100;
            if (internalTimer <= amount) {
                Reveal.navigateNext();
                internalTimer = autoSlide;
            }
        }, 100);
        //*/

        function checkNext() {
            console.info('checking next', internalTimer, amount);
            if (internalTimer <= amount) {
                Reveal.navigateNext();
                internalTimer = autoSlide;
            }
        }

        function updateSlide() {
            socket.emit('update_slide', Reveal.getCurrentSlide().id);
        }
    }

    function initButtonInteraction(d) {
        var socket = io.connect(window.location.protocol+'//'+window.location.hostname);
        d.getElementById('help-me').addEventListener('click', function(){
            var helped = localStorage.getItem('help') || [];
            socket.emit('help', JSON.stringify(helped) || []);
        });
        socket.on('helpReturn', function(slideName){
            let item = localStorage.getItem('help');
            var helped = (item ? item.split(',') : []) || [];
            helped.push(slideName);
            localStorage.setItem('help', helped.join(','));
        });
        socket.on('message', function(msg) {
            message(msg);
        });
    }

    w.initButtonInteraction = initButtonInteraction;
    w.initPresentation = initPresentation;
})(window, document);
