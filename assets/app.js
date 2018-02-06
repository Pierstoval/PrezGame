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
