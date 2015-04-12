var http = require('http');
var url = require('url');

/**
 * Tracker
 * Cookieless tracker class. Generates IDs for new visitors
 * and tracks visitors' sessions
 * @param Object  req     A reference for the request
 * @param Boolean update  Optional (default: true) Pass false if you do not want
 *                        the session to be updated automatically
 */
function Tracker(req, update) {
  if (typeof update === 'undefined') update = true;
  var reqUrl = url.parse(req.url, true);
  this.updated = false;
  this.callback = reqUrl.query.callback || 'cookielessCallback';
  this.etag = req.headers['if-none-match'] || this.generateEtag();
  this.parse();
  if (update)
    this.update();
}

/**
 * Generate ETag
 * Generates the visitor's unique ETag based on their information
 * {id}.{date now}.{session number}
 * @return {String} The generated ETag
 */
Tracker.prototype.generateEtag = function() {
  var now       = (new Date()).getTime();
  this.id       = this.id || this.generateId();
  this.session  = this.session || 1;
  this.updated  = true;
  return this.id+"."+now+"."+this.session;
}

/**
 * Generate ID
 * Generates a unique ID for a visitor
 * @return {String} The visitor's unique identifier
 */
Tracker.prototype.generateId = function() {
  var now = (new Date()).getTime();
  return Math.floor(Math.random()*100)+""+now;
}

/**
 * Update
 * Updates the visitor's session if they were last seen
 * more than 30 minutes ago.
 * @return {Object} Tracker object
 */
Tracker.prototype.update = function() {
  if (!this.updated) {
    var now = (new Date()).getTime();
    var diff = now - this.lastSeen;
    if (diff >= 1800000) {
      this.session++;
      this.etag = this.generateEtag();
    }
  }
  return this;
}

/**
 * Parse
 * Parses the ETag to extract the visitor's information
 * @return {Object} The tracker object
 */
Tracker.prototype.parse = function() {
  this.id       = this.etag.match(/^([^.]+)/)[1];
  this.lastSeen = parseInt(this.etag.match(/^[^.]+\.([^.]+)/)[1]);
  this.session  = this.etag.match(/\.([^.]+)$/)[1];
  return this;
}

/**
 * Status Code
 * Returns the status code that should be sent with the response
 * @return {Number} Returns 200 if the response has changed, 304 otherwise
 */
Tracker.prototype.statusCode = function() {
  return this.updated ? 200 : 304;
}

/**
 * Build Header
 * Builds a response header that may be extended and sent
 * with the response. It will see the Content-Type to text/javascript
 * and the ETag depending on the unique generated value.
 * @return {Object} The header object with Content-Type and ETag set
 */
Tracker.prototype.buildHeader = function() {
  return {
    'Content-Type': 'text/javascript',
    'ETag': this.etag
  }
}

/**
 * Build Script
 * Builds the JSONP callback script with the visitor's information
 * as the argument for the callback function.
 * @param  {String} callback  Name of the callback function
 * @return {String}           Snippet of javascript for the JSONP response
 */
Tracker.prototype.buildScript = function(callback) {
  callback = callback || this.callback;
  return "; typeof "+callback+" === 'function' && "+
    callback+"({"+
    "id: "+this.id+","+
    "session: "+this.session+","+
    "lastSeen: "+this.lastSeen+"}"+
    ");";
}

/**
 * Respond
 * Builds the response headers and body.
 * The response will be 304 if the etag has not been updated, otherwise it will be 200.
 * The body is a JSONP script with the information about the user.
 * @param  {String} callback  (optional) Name of the JSONP callback function
 * @param  {Object} res       The response object
 * @return {Object}           The same response object after res.end()
 */
Tracker.prototype.respond = function(callback, res) {
  if (typeof res === 'undefined') {
    res = callback;
    callback = null;
  }
  callback = callback || this.callback;
  res.writeHead(this.statusCode(), this.buildHeader());
  if (this.updated)
    res.end(this.buildScript(callback));
  else
    res.end();
  return res;
}

/**
 * Start Beacon
 * Starts a tracking server in a given port and interface.
 * It will listen for requests on http://0.0.0.0/i.js[?callback=setVisitor].
 * @param  {Number}   port              Port where the server will be listening
 * @param  {String}   host              The interface the server will start
 * @param  {Function} onVisitorCallback A callback that will be called everytime a
 *                                      visitor calls the beacon
 */
Tracker.startBeacon = function(port, host, onVisitorCallback) {
  var proxy = http.createServer(function (req, res) {
    if (req.url.match(/^\/i\.js/)) {
      var tracker = new Tracker(req, true);
      if (typeof onVisitorCallback === 'function') onVisitorCallback(tracker);
      tracker.respond(res);
    } else {
      res.end();
    }
  });

  return proxy.listen(port || 7123, host || '127.0.0.1');
}

Tracker.startBeacon(7123, '0.0.0.0', function(visitor) {
  console.log(visitor);
});

module.exports = Tracker;
