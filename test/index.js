var should = require('should');
var Cookieless = require('../lib/index');

var now = (new Date()).getTime();

var request = {
  simple: {
    url: 'http://tracker.com/i.js',
    headers: {}
  },

  with_callback: {
    url: 'http://tracker.com/i.js?callback=setVisitor',
    headers: {}
  },

  with_headers: {
    url: 'http://tracker.com/i.js',
    headers: {
      'if-none-match': "681429050444587." + now + ".1"
    }
  },

  with_old_headers: { //more than 30 minutes ago
    url: 'http://tracker.com/i.js',
    headers: {
      'if-none-match': "751429049947678.1429043947680.2"
    }
  }
}

console.log((new Cookieless(request.simple)).generateEtag())

describe('Cookieless', function() {

  describe('on initialize', function() {
    it('should set the callback', function() {
      (new Cookieless(request.with_callback)).callback.should.equal('setVisitor');
    });

    it ('should set callback to "cookielessCallback" as default', function() {
      (new Cookieless(request.simple)).callback.should.equal('cookielessCallback');
    });

    it('should generate a ETag', function() {
      (new Cookieless(request.simple)).etag.should.match(/^[^.]+\.[^.]+\.1$/);
    });

    it('should parse ETag correctly', function() {
      var tracker = new Cookieless(request.with_headers);
      tracker.id.should.equal('681429050444587');
      tracker.lastSeen.should.equal(now);
      tracker.session.should.equal(1);
    });

    it('should update the session correctly', function() {
      var tracker = new Cookieless(request.with_old_headers);
      var tracker_no_update = new Cookieless(request.with_old_headers, false);
      tracker.session.should.equal(3);
      tracker_no_update.session.should.equal(2);
    });
  }); //on initialize

  describe('tracker object', function() {
    describe('on statusCode()', function() {
      it('should return 200 if new ETag', function() {
        (new Cookieless(request.simple)).statusCode().should.equal(200);
      });

      it('should return 200 if ETag has not changed', function() {
        (new Cookieless(request.with_headers)).statusCode().should.equal(304);
      });

      it('should return 304 if session is updated', function() {
        (new Cookieless(request.with_old_headers)).statusCode().should.equal(200);
      });
    });

    describe('on buildHeader()', function() {
      it('should send etag and text/javascript', function() {
        var header = (new Cookieless(request.with_old_headers, false)).buildHeader();
        header.should.have.properties({
          'Content-Type': 'text/javascript',
          'ETag': '751429049947678.1429043947680.2'
        });
      });
    });

    describe('on buildScript()', function() {
      it('should return JSONP function call', function() {
        var jsonp = (new Cookieless(request.with_old_headers, false)).buildScript();
        jsonp.should.equal("; typeof cookielessCallback === 'function' && cookielessCallback({id: 751429049947678,session: 2,lastSeen: 1429043947680});");
      });

      it('should use callback if passed in argument', function() {
        var jsonp = (new Cookieless(request.with_old_headers, false)).buildScript('setVisitor');
        jsonp.should.equal("; typeof setVisitor === 'function' && setVisitor({id: 751429049947678,session: 2,lastSeen: 1429043947680});");
      });
    });

    describe('on respond()', function() {
      it('should send script with headers', function() {
        var tracker = new Cookieless(request.with_old_headers);
        tracker.respond({ writeHead: writeHead, end: end });

        function writeHead(status, header) {
          status.should.equal(200);
          header['Content-Type'].should.equal('text/javascript');
          header['ETag'].should.match(/751429049947678\.[0-9]+\.3/);
        }

        function end(script) {
          script.should.match(/; typeof cookielessCallback === \'function\' .+ cookielessCallback\([^)]+\)\;/);
        }
      });

      it('should send script with given callback', function() {
        var tracker = new Cookieless(request.with_old_headers);
        tracker.respond('setVisitor', { writeHead: function(){}, end: end });

        function end(script) {
          script.should.match(/; typeof setVisitor === \'function\' .+ setVisitor\([^)]+\)\;/);
        }
      });
    });
  }); //tracker object

  describe('on generateId()', function() {
    it('should generate ID', function() {
      var id = Cookieless.generateId();
      (typeof id).should.equal('string');
      id.length.should.not.equal(0);
    });

    it('should generate a unique ID', function() {
      Cookieless.generateId().should.not.equal(Cookieless.generateId());
    });
  }); //on generateId()

}); //cookieless
