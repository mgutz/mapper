/**
 * Module dependencies.
 */

var helper = require('../test_helper.js');
var fs = require('fs');
var Mapper = require('../..');
var async = require('async');
var _ = require('lodash')._;

/**
 * Logging.
 */

var logging = false;

/**
 * Integration test.
 */

module.exports = {
  'integrates': function(done) {
    var config = require(__dirname + '/../../.mapper.json');

    Mapper.connect(config/*, {verbose: true}*/);

    var posts = [
      { id: 1, title: 'Some Title 1', blurb: 'Some blurb 1',
        body: 'Some body 1', published: false },
      { id: 2, title: 'Some Title 2',
        body: 'Some body 2', published: true },
      { id: 3, title: 'Some Title 3', blurb: 'Some blurb 3',
        body: 'Some body 3', published: true },
      { id: 4, title: '\'lol\\"', blurb: 'Extra\'"\\"\'\'--',
        body: '"""--\\\'"', published: false }
    ]

    var comments = [
      { id: 1, post_id: 1, comment: 'Comment 1', created_at: new Date() },
      { id: 2, post_id: 1, comment: 'Comment 2', created_at: new Date() },
      { id: 3, post_id: 2, comment: 'Comment 3', created_at: new Date() },
      { id: 4, post_id: 2, comment: 'Comment 4', created_at: new Date() },
      { id: 5, post_id: 3, comment: 'Comment 5', created_at: new Date() },
      { id: 6, post_id: 3, comment: 'Comment 6', created_at: new Date() },
      { id: 7, post_id: 4, comment: 'Comment 7', created_at: new Date() },
      { id: 8, post_id: 4, comment: 'Comment 8', created_at: new Date() }
    ]

    var Comment = Mapper.Base.extend({
      tableName: 'comments',
      primaryKey: 'id'
    });

    var Post = Mapper.Base.extend({
      tableName: 'posts',
      primaryKey: 'id',
      many: [
        { 'comments': Comment, joinOn: 'post_id' }
      ]
    });

    async.series({
      'setup: truncates database': function(callback) {
        Comment.truncate(function(err, result) {
          assert.ifError(err);
          if (err) return callback(err);

          //Post.truncate({ cascade: true }, function(err, result) {
          Post.truncate({}, function(err, result) {
            if (err) return callback(err);
            assert.ifError(err);
            assert.ok(result.affectedRows >= 0);
            callback(err, result);
          });
        });
      },

      // TODO should batch insert be allowed
      'create: create multiple posts': function(callback) {
        Post.create(posts, function(err, result) {
          assert.equal(posts.length, result.affectedRows);
          callback(err, result);
        });
      },

      'create: create multiple comments': function(callback) {
        Comment.create(comments, function(err, result) {
          assert.equal(comments.length, result.affectedRows);
          callback(err, result);
        })
      },

      'find: find a post by primary key': function(callback) {
        Post.find(posts[0].id, function(err, results) {
          assert.equal(posts[0].title, results.title);
          callback(err, results);
        });
      },
      'find: find a post and only return certain fields': function(callback) {
        Post.find(posts[1].id, { only: ['id'] }, function(err, results) {
          assert.isUndefined(results.title);
          callback(err, results);
        });
      },
      'find: find a comment by primary key': function(callback) {
        Comment.find(comments[0].id, function(err, results) {
          assert.equal(comments[0].comment, results.comment);
          callback(err, results);
        });
      },
      'find: find a comment and only return certain fields': function(callback) {
        Comment.find(comments[1].id, { only: ['id'] }, function(err, results) {
          assert.isUndefined(results.comment);
          callback(err, results);
        });
      },
      'find: find a post with a basic include(join)': function(callback) {
        Post.find(posts[0].id, {
          include: {
            'comments': { }
          }
        }, function(err, results) {
            assert.equal(2, results.comments.length);
            callback(err, results);
        })
      },
      'find: find a post with advanced include(join) opts': function(callback) {
        Post.find({ 'blurb.like': '%Some blurb%' }, {
          only: ['id', 'blurb'],
          include: {
            'comments': {
              where: {'published': true },
              only: ['id', 'post_id', 'published'],
              order: ['id']
            }
          }
        }, function(err, results) {
          assert.equal(2, results[0].comments.length);
          callback(err, results);
        });
      },
      'find: multiple comments by id': function(callback) {
        var ids = _.pluck(comments, 'id');
        Comment.find(ids, function(err, results) {
          assert.equal(ids.length, results.length);
          callback(err, results)
        })
      },
      'find: properly ignores unknown columns': function(callback) {
        Post.find({ 'body': 'Some body 2' }, {
          only: ['id', 'bad_field']
        }, function(err, results) {
          assert.equal(1, results.length);
          callback(err, results);
        })
      },
      'find: ignores all unknown columns returning everything': function(callback) {
        Post.find({ 'id': 1 }, {
          only: ['bad_field']
        }, function(err, results) {
          assert.equal(1, results.length);
          callback(err, results);
        });
      },
      'find: ignores empty only clause returning everything': function(callback) {
        Post.find({ 'id': 2 }, {
          only: []
        }, function(err, results) {
          assert.equal(1, results.length);
          callback(err, results);
        });
      },
      'find: find using in clause with one item': function(callback) {
        Post.find({
          'title.in': ['Some Title 1']
        }, function(err, results) {
          assert.equal(1, results.length);
          callback(err, results);
        });
      },
      'find: find using in clause with multiple items': function(callback) {
        Post.find({
          'title.in': ['Some Title 1', 'Some Title 2']
        }, function(err, results) {
          assert.equal(2, results.length);
          callback(err, results);
        });
      },
      'find: find using nin clause with one item': function(callback) {
        Post.find({
          'title.nin': ['Some Title 1']
        }, function(err, results) {
          assert.equal(3, results.length);
          callback(err, results);
        });
      },
      'find: find using nin clause with multiple items': function(callback) {
        Post.find({
          'title.nin': ['Some Title 1', 'Some Title 2']
        }, function(err, results) {
          assert.equal(2, results.length);
          callback(err, results);
        });
      },
      'find: find using not_in clause with one item': function(callback) {
        Post.find({
          'title.nin': ['Some Title 1']
        }, function(err, results) {
          assert.equal(3, results.length);
          callback(err, results);
        });
      },
      'find: find using not_in clause with multiple items': function(callback) {
        Post.find({
          'title.nin': ['Some Title 1', 'Some Title 2']
        }, function(err, results) {
          assert.equal(2, results.length);
          callback(err, results);
        });
      },
      'findOne: comment via a basic selector': function(callback) {
        Comment.findOne({ 'comment':'Comment 5' }, function(err, comment) {
          assert.equal('Comment 5', comment.comment);
          callback(err, comment);
        });
      },
      'findOne: returns undefined when not found': function(callback) {
        Comment.findOne({ 'comment':'Comment 18' }, function(err, comment) {
          assert.equal(undefined, comment);
          callback(err, comment);
        });
      },
      'findOne: find a post with a basic include(join)': function(callback) {
        Post.findOne({ 'title': 'Some Title 1' }, {
          include: {
            'comments': { }
          }
        }, function(err, results) {
          assert.equal(2, results.comments.length);
          callback(err, results);
        })
      },
      'find: find a post and return alias fields': function(callback) {
        Post.find({ 'id': 1 }, {
          only: {  'title'     : 'some_alias_title'
                 , 'blurb'     : 'some_alias_blurb'
                 , 'body'      : 'some_alias_body'
                 , 'published' : 'some_alias_published'}
        }, function(err, results) {
          assert.equal(posts[0].title, results[0]['some_alias_title']);
          assert.equal(posts[0].body, results[0]['some_alias_body']);
          assert.equal(posts[0].published, results[0]['some_alias_published']);
          assert.equal(posts[0].blurb, results[0]['some_alias_blurb']);
          callback(err, results);
        });
      },
      'find: find a post and order results descending using aliased columns': function(callback) {
        Post.find([1,2], {
          only: { 'title' : 'some_alias_title',
                  'id'    : 'some id'},
          order: ['-some id']
        }, function(err, results) {
          assert.equal(posts[1].id, results[0]['some id']);
          assert.equal(posts[0].id, results[1]['some id']);
          callback(err, results);
        });
      },
      'find: find last 2 post ids using offset': function(callback) {
        Post.find({}, { only: ['id'], limit: 2, offset: 2 }, function(err, results) {
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[3].id, results[1].id);
          callback(err, results);
        })
      },
      'find: find with order and limit': function(callback) {
        Post.find({}, {
          only: ['id'],
          order: ['-id'],
          limit: 1
        }, function(err, results) {
          assert.equal(posts[3].id, results[0].id);
          callback(err, results);
        })
      },
      'find: find with order and offset': function(callback) {
        Post.find({}, {
          only: ['id'],
          order: ['-id'],
          limit: 3,
          offset: 1
        }, function(err, results) {
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[1].id, results[1].id);
          assert.equal(posts[0].id, results[2].id);
          callback(err, results);
        })
      },
      'find: find with order, offset and limit': function(callback) {
        Post.find({}, {
          only: ['id'],
          order: ['-id'],
          offset: 1,
          limit: 2
        }, function(err, results) {
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[1].id, results[1].id);
          callback(err, results);
        })
      },
      'find: find a post with empty blurbs': function(callback) {
        var expected = 0;
        _.each(posts, function(post) {
          if (_.isNull(post.blurb) || _.isUndefined(post.blurb)) { expected++; }
        });

        Post.find({'blurb' : null}, function(err, results) {
          assert.equal(expected, results.length);
          callback(err, results);
        });
      },
      'update: new post title': function(callback) {
        Post.update({ 'title': 'Some Title 1' }, {
          'title': 'Renamed Title'
        }, function(err, results) {
          assert.equal(1, results.affectedRows);
          callback(err, results);
        });
      },
      'update: new post title with weird characters': function(callback) {
        var newTitle = '"\'pants';
        Post.update(4, {'title' : newTitle}, function(er, results) {
          assert.equal(1, results.affectedRows);
          Post.findOne(4, function(er, post) {
            assert.equal(newTitle, post.title);
            callback(er, post);
          });
        });
      },
      'destroy: comment by primary key': function(callback) {
        Comment.destroy(8, function(err, results) {
          assert.equal(1, results.affectedRows);
          callback(err, results);
        });
      },
      'destroy: multiple comments by primary key': function(callback) {
        Comment.destroy([7, 6], function(err, results) {
          assert.equal(2, results.affectedRows);
          callback(err, results);
        });
      },
      'destroy: comment via a basic selector': function(callback) {
        Comment.destroy({ 'comment':'Comment 5' }, function(err, results) {
          assert.equal(1, results.affectedRows);
          callback(err, results);
        });
      },
      'destroy: all comments': function(callback) {
        Comment.destroy(function(err, results) {
          assert.equal(4, results.affectedRows);
          callback(err, results);
        });
      },
      'destroy: nothing via empty selector': function(callback) {
        Comment.destroy(function(err, results) {
          assert.equal(0, results.affectedRows);
          callback(err, results);
        });
      },
      'destroy: nothing via empty array': function(callback) {
        Comment.destroy([], function(err, results) {
          assert.equal(0, results.affectedRows);
          callback(err, results);
        });
      },
      'destroy: error on bad selector': function(callback) {
        Comment.destroy({ 'bad_field': 3 }, function(err, results) {
          //console.error("ERRR", err);
          assert.ok(err instanceof Error);
          // assert.ifError(err);
          // assert.equal(0, results.affectedRows);
          callback(null, results);
        });
      },
      'truncate': function(callback) {
        Post.truncate(function(err, results) {
          // even the mysql command line client shows 0 rows affected
          // i expected > 0 here
          assert.ok(results.affectedRows >= 0);
          callback(err, results);
        });
      },
/*
      THESE DONT LOOK RIGHT
      'find: nothing': function(callback) {
        var ids = _.pluck(posts, 'id');
        console.log("ids", ids);
        Post.find(ids, function(err, results) {
          assert.equal([], results);
          callback(err, results);
        });
      },
      'find: nothing': function(callback) {
        Post.find(posts[0].id, function(err, result) {
          assert.isNull(result);
          callback(err, result);
        });
      },
*/
      'find: no posts with bad selector': function(callback) {
        Post.find({ 'bad_field': 12 }, function(err, result) {
          assert.ok(err instanceof Error);
          callback(null, result);
        });
      }
    },
    function(err, result) {
      process.nextTick(function() {
        if (err)
          console.error("FAIL", err);
        else
          console.log("OK");
      });
      if (logging) {
        if (err)
          console.error(err);
        else
          console.log(result);
      }
      Mapper.client.disconnect();
      done();
    });
  }
};
