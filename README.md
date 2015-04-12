# Cookieless.js
#### Cookieless user tracking for node.js

Cookieless.js is a lightweight implementation of visitor's tracking using **ETag** for Node.js. It **may** be used on its own or along side other tracking methods (cookies or browser fingerprinting), so whenever one solution fails, you may fallback to a back up one.

Read more about ETag [here](http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.19).

This package allows you to use the visitor's information both **server side** and **client side** by providing a JSONP API.

## Install
```bash
npm install cookieless --save
```

## Example
#### Server side
The following example starts a tracking beacon at: http://127.0.0.1/i.js?callback=setVisitor
```javascript
var CookielessTracker = require('cookieless');

/*
Note: it's not mandatory to start a beacon, you may handle the requests
      yourself and just use the tracker's API
*/
CookielessTracker.startBeacon(7123, '0.0.0.0', function(visitor) {
  redis.incr('visits.'+visitor.id);
});
```
#### Client side *(browser)*
```javascript
$.ajax({
    url: "http://127.0.0.1:7123/i.js",
    jsonp: "callback",
    dataType: "jsonp",
    success: function( visitor ) {
        //Do something
        trackImpressionFor(visitor.id, visitor.session); //example
    }
});
```

## API
#### *(static)* startBeacon(port*=7123*, host=*'0.0.0.0'*, onVisitorCallback)
The easiest way of hit the ground running is by using the built-in lightweight beacon, which starts a listener and processes the tracking requests. If a **onVisitorCallback** function is given, it will be called everytime a visitor calls the endpoint.
```javascript
var CookielessTracker = require('cookieless');
CookielessTracker.startBeacon(7123, '0.0.0.0', function(visitor) {
  console.log("Visitor " + visitor.id + " has visited us " + visitor.session +
              " times. Last time was on " + visitor.lastSeen);
});
```
The endpoint will be available at http://127.0.0.1/i.js?callback=setVisitor and the response will be:
```javascript
; typeof setVisitor === 'function' && setVisitor({id: 31428830410917,session: 3,lastSeen: 1428830410917});
```

####Contructor(request, update=true)
Initializes a new visitor (may be returning visitor) from a request. If it is a **new visitor** it will automatically generate a **new unique ETag**.

If **_update_** is set to **_true_**, it will automatcally update the visitor's session if they were last seen **over** 30 minutes ago. _(Otherwise you'll have to manually call the **update** API)_.
```javascript
var CookielessTracker = require('cookieless');

http.createServer(function (req, res) {
  var visitor = new CookielessTracker(req);
  console.log("This visitor is on his " + visitor.session + " visit!");
  visitor.respond(res);
});
```
####respond([callback,] res)
Given a *response* object, it will build and send a JSONP response to the visitor with the callback function name (if given). It is a combination of **statusCode()**, **buildHeader()**, and **buildScript()**.
_(**Important:** the callback function name should be set and never changed, otherwise the tracking will be reset)_
```javascript
http.createServer(function (req, res) {
  var visitor = new CookielessTracker(req);
  // Do something
  visitor.respond('setVisitor', res);
});
```

####buildScript([callback])
Builds the JSONP script with the visitor's information, the **callback** argument is a **string** with name of the callback function for the JSONP response. _(If the request has a callback set in the query string, it will be the default value)_
```javascript
console.log(visitor.buildScript('setVisitor'));
//Outputs:
//; typeof setVisitor === 'function' && setVisitor({id: 31428830410917,session: 3,lastSeen: 1428830410917});
```
####buildHeader()
Builds the header for the response including the identifier ETag.
```javascript
//Output:
{
  'Content-Type': 'text/javascript',
  'ETag': "31428830410917.1428830410917.3"
}
```
####statusCode()
It gives the most appropriate **status code** for a **tracking response**. The response only changes when the session number gets updated, in that case the stattus **will be 200**, any other case should return **304**.
```javascript
var visitor = new CookielessTracker(req);
res.writeHead(visitor.statusCode(), visitor.buildHeader());
```

