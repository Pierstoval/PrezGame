(function(w, d){
    var messageBlock = d.getElementById('messages');

    function ajax(method, url, params, callback) {
        const request = new XMLHttpRequest();

        request.open(method, url, true);

        request.onload = function() {
            if (this.status >= 200 && this.status < 400) {
                if (typeof callback === 'function') {
                    callback.apply(this, [this.response]);
                }
            } else {
                console.error(this);
                throw 'The server returned an error after an AJAX request.';
            }
        };

        request.onerror = function() {
            console.error(this);
            throw 'An error occured in an AJAX request.';
        };

        request.send(params);
    }

    function message(msg){
        if (!messageBlock) {
            console.error('Cannot write a message, element "#messages" doesn\'t exist');
            return;
        }

        var element = document.createElement('p');
        element.innerHTML = msg;
        messageBlock.appendChild(element);

        setTimeout(function(){
            messageBlock.removeChild(element);
        }, 5000);
    }

    w.ajax = ajax;
    w.message = message;
})(window, document);
