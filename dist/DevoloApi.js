"use strict";
var DevoloAPI = (function () {
    function DevoloAPI() {
        this._apiHost = 'www.mydevolo.com';
        this._apiVersion = '/v1';
        if (DevoloAPI._instance) {
            throw new Error("Singleton...");
        }
        DevoloAPI._instance = this;
    }
    DevoloAPI.getInstance = function () {
        return DevoloAPI._instance;
    };
    DevoloAPI.prototype.setOptions = function (options) {
        this._options = options;
    };
    DevoloAPI.prototype.call = function (method, path, data, callback, json, type, user, pass, cookie) {
        var options = {
            'method': method,
            'hostname': (type == 0) ? this._apiHost : this._options.centralHost,
            'path': (type == 0) ? this._apiVersion + path : path,
            'headers': {}
        };
        if (user && pass) {
            options.headers['Authorization'] = 'Basic ' + new Buffer(user + ':' + pass).toString('base64');
        }
        if (cookie) {
            options.headers['Cookie'] = cookie;
        }
        var body = null;
        switch (method) {
            case 'GET':
                break;
            case 'POST':
                body = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        var protocol = (type == 0) ? require('https') : require('http');
        var req = protocol.request(options, function (res) {
            if (!callback)
                return;
            var chunks = [];
            var cookieString = '';
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });
            if (res.headers["set-cookie"]) {
                res.headers["set-cookie"].forEach(function (cookie) {
                    cookieString += cookie;
                });
            }
            //1            console.log(options);
            res.on('end', function () {
                var body = Buffer.concat(chunks);
                //1                console.log(body.toString());
                if (!json) {
                    callback(null, body.toString(), res.statusCode, cookieString);
                    return;
                }
                var jsonStr;
                try {
                    jsonStr = JSON.parse(body.toString());
                    callback(null, jsonStr, res.statusCode, cookieString);
                }
                catch (err) {
                    callback(err);
                }
            });
            res.on('close', function (err) {
                callback(err);
            });
        });
        req.setTimeout(10000, function () {
            req.connection.destroy();
        });
        body && req.write(body, 'utf8');
        req.end();
        req.on('error', function (err) {
            if (callback)
                callback(err);
        });
    };
    ;
    DevoloAPI.prototype.fetchUUID = function (callback) {
        this.call('GET', '/users/uuid', null, function (err, res, statusCode) {
            if (!callback)
                return;
            if (err) {
                callback(err);
                return;
            }
            if (statusCode != 200) {
                callback('Authorization failed. Check email and password.');
                return;
            }
            callback(null, res.uuid);
        }, true, 0, this._options.email, this._options.password);
    };
    ;
    DevoloAPI.prototype.fetchGateway = function (callback) {
        this.call('GET', '/users/' + this._options.uuid + '/hc/gateways', null, function (err, res, statusCode) {
            if (!callback)
                return;
            if (err) {
                callback(err);
                return;
            }
            if (statusCode != 200) {
                callback('Could not fetch gateway. Try again later.');
                return;
            }
            //       console.log(res);
            var gatewayHref = res.items[0].href;
            callback(null, gatewayHref.split("/gateways/").pop());
        }, true, 0, this._options.email, this._options.password);
    };
    ;
    DevoloAPI.prototype.fetchPasskey = function (callback) {
        this.call('GET', '/users/' + this._options.uuid + '/hc/gateways/' + this._options.gateway, null, function (err, res, statusCode) {
            if (!callback)
                return;
            if (err) {
                callback(err);
                return;
            }
            if (statusCode != 200) {
                callback('Could not fetch passkey. Try again later.');
                return;
            }
            callback(null, res.localPasskey);
        }, true, 0, this._options.email, this._options.password);
    };
    ;
    DevoloAPI.prototype.fetchSessionid = function (callback) {
        var self = this;
        this.call('GET', '/dhlp/portal/light', null, function (err, res, statusCode) {
            if (!callback)
                return;
            if (err) {
                callback(err);
                return;
            }
            if (statusCode != 200) {
                callback('Could not get dhlp portal. Try again later.');
                return;
            }
            var link = res.link;
            var token = res.link.split("?token=").pop();
            self.call('GET', '/dhlp/portal/light/?token=' + token, null, function (err, res, statusCode, cookies) {
                if (err) {
                    callback(err);
                    return;
                }
                if (!cookies) {
                    callback('Could not get session. Try again later.');
                    return;
                }
                var sessionid = cookies.split("JSESSIONID=").pop();
                sessionid = sessionid.split("; ").shift();
                callback(null, sessionid);
            }, false, 1, self._options.uuid, self._options.passkey);
        }, true, 1, this._options.uuid, this._options.passkey);
    };
    ;
    DevoloAPI.prototype.fetchItems = function (deviceids, callback) {
        var data = {
            jsonrpc: '2.0',
            method: 'FIM/getFunctionalItems',
            params: [
                deviceids,
                0
            ]
        };
        this.call('POST', '/remote/json-rpc', data, function (err, res) {
            if (!callback)
                return;
            if (err) {
                callback(err);
                return;
            }
            if (res.error) {
                callback(res.error.message);
                return;
            }
            if (!res.result || !res.result.items) {
                callback('Items missing at device ' + deviceids + ' > ' + res);
                return;
            }
            callback(null, res.result.items);
        }, true, 1, null, null, 'JSESSIONID=' + this._options.sessionid);
    };
    ;
    DevoloAPI.prototype.invokeOperation = function (sensor, operation, callback, value) {
        if (value === void 0) { value = []; }
        var data = {
            jsonrpc: '2.0',
            method: 'FIM/invokeOperation',
            params: [
                sensor.id,
                operation,
                value
            ]
        };
        this.call('POST', '/remote/json-rpc', data, function (err, res) {
            if (!callback)
                return;
            if (err) {
                callback(err);
                return;
            }
            callback();
        }, true, 1, null, null, 'JSESSIONID=' + this._options.sessionid);
    };
    return DevoloAPI;
}());
DevoloAPI._instance = new DevoloAPI();
exports.DevoloAPI = DevoloAPI;
;
