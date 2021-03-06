/*
* task pools
*/
var debug = require('debug');
var log = debug('dbj:pool:info');
var error = debug('dbj:pool:error');

var gpool = require('generic-pool');
var douban = require('./douban');

var conf = require(process.cwd() + '/conf');

// http(s) request pool, mainly for douban api
var api_pool = gpool.Pool({
  name: 'api',
  create: function(callback) {
    var oauth2 = new douban.OAuth2(conf.douban.key, conf.douban.secret);
    callback(null, oauth2);
  },
  destroy: function() { },
  max: 1,
  //min: 5,
  priorityRange: 5,
  //log: conf.debug ? log : false
});

var computings = { n: 0 };
var compute_pool = gpool.Pool({
  name: 'compute',
  create: function(callback) {
    computings.n++;
    callback(null, computings);
  },
  destroy: function() { computings.n--; },
  max: 2,
  priorityRange: 3,
});

function queue(pool, default_priority) {
  return function(fn, priority) {
    pool.acquire(function(err, client) {
      // `fn` defination is like `fn(db, next)`;
      if (fn.length === 2) {
        //log('async calling job');
        fn(client, function(err) {
          if (err) error('async job:\n%s\nfailed because:\n%s', job.toString(), err);
          pool.release(client);
        });
      } else {
        fn(client);
        pool.release(client);
      }
    }, typeof priority === 'undefined' ? default_priority : priority);
  }
}

module.exports = {
  api_pool: api_pool,
  compute_pool: compute_pool,
  compute: queue(compute_pool),
  api: queue(api_pool, 3), // default priority is 3
  API_REQ_DELAY: 60000 / (conf.douban.limit || 5),
  API_REQ_PERPAGE: 100,
  queue: queue
};
