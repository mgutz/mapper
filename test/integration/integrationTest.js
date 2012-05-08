/**
 * Module dependencies.
 */

var helper = require('../test_helper.js')
  , fs = require('fs')
  , Mapper = require('../..')
  , async = require('async')
  , _ = require('lodash');


var posts = [
  { id: 1, title: 'Some Title 1', blurb: 'Some blurb 1',
    body: 'Some body 1', published: false },
  { id: 2, title: 'Some Title 2',
    body: 'Some body 2', published: true },
  { id: 3, title: 'Some Title 3', blurb: 'Some blurb 3',
    body: 'Some body 3', published: true },
  { id: 4, title: '\'lol\\"', blurb: 'Extra\'"\\"\'\'--',
    body: '"""--\\\'"', published: false }
];

var comments = [
  { id: 1, postId: 1, comment: 'Comment 1', created_at: new Date() },
  { id: 2, postId: 1, comment: 'Comment 2', created_at: new Date() },
  { id: 3, postId: 2, comment: 'Comment 3', created_at: new Date() },
  { id: 4, postId: 2, comment: 'Comment 4', created_at: new Date() },
  { id: 5, postId: 3, comment: 'Comment 5', created_at: new Date() },
  { id: 6, postId: 3, comment: 'Comment 6', created_at: new Date() },
  { id: 7, postId: 4, comment: 'Comment 7', created_at: new Date() },
  { id: 8, postId: 4, comment: 'Comment 8', created_at: new Date() },
  { id: 9, postId: 4, comment: 'Comment 9', created_at: new Date() }
];


var tags = [
  { id: 1, name: 'funny' },
  { id: 2, name: 'coding' },
  { id: 3, name: 'javascript' },
  { id: 4, name: 'git' }
];

var postsTags = [
  { id: 1, postId: 1, tagId: 1 },
  { id: 2, postId: 1, tagId: 2 },
  { id: 3, postId: 2, tagId: 3 },
  { id: 4, postId: 2, tagId: 3 },
  { id: 5, postId: 3, tagId: 1 },
  { id: 6, postId: 4, tagId: 4 }
];

var moreDetails = [
  { id: 1, postId: 1, extra: 'extra' },
];


var Comment = Mapper.map("Comments")
  , Post = Mapper.map("Posts")
  , PostTag = Mapper.map("PostsTags")
  , MoreDetail = Mapper.map("PostMoreDetails")
  , Tag = Mapper.map("Tags");


// Post has many tags through PostTag.tagId joined on PostTag.postId
Post.hasManyThrough("tags", Tag, "tagId", PostTag, "postId");

// Post.comments though Comment(postId)
Post.hasMany("comments", Comment, "postId");

// Post.moreDetails through PostMoreDetails(postId)
Post.hasOne("moreDetails", MoreDetail, "postId");

// Comment.post through Comment(postId)
Comment.belongsTo("post", Post, "postId");



/**
 * Integration test.
 */

describe("Dao", function() {

  before(function(done) {
    async.series([
      function(cb) { PostTag.truncate(cb); },
      function(cb) { MoreDetail.truncate(cb); },
      function(cb) { Comment.truncate(cb); },
      function(cb) { Tag.truncate(cb); },
      function(cb) { Post.truncate(cb); },

      function(cb) { Post.insert(posts).exec(cb); },
      function(cb) { Comment.insert(comments).exec(cb); },
      function(cb) { Tag.insert(tags).exec(cb); },
      function(cb) { MoreDetail.insert(moreDetails).exec(cb); },
      function(cb) { PostTag.insert(postsTags).exec(cb); }
    ], done);
  });


  describe("Select", function() {

    it('find a post by primary key using object', function(done) {
      Post
        .where({id: posts[0].id})
        .one(function(err, row) {
          assert.equal(posts[0].title, row.title);
          done();
        });
    });

    it('finds a post using string and only return certain fields', function(done) {
      Post
        .select('id')
        .where('id = ?', [posts[1].id])
        .one(function(err, row) {
          assert.equal(row.id, posts[1].id);
          assert.isUndefined(row.title);
          done();
        });
    });

    it('properly ignores unknown columns', function(callback) {
      Post
        .select(['id', 'bad_field'])
        .where({'body': 'Some body 2'})
        .all(function(err, results) {
          assert.equal(1, results.length);
          callback(err, results);
        })
    });

    it('ignores all unknown columns returning everything', function(callback) {
      Post
        .select(['bad_field'])
        .where({id: 1})
        .all(function(err, results) {
          assert.equal(1, results.length);
          callback(err, results);
        });
    });

    it('ignores empty only clause returning everything', function(done) {
      Post.select([]).where({id: 2 }).all(function(err, results) {
        assert.equal(1, results.length);
        done();
      });
    });

    it('finds using in clause with one item', function(done) {
      Post.where({ 'title IN': [['Some Title 1']] }).all(function(err, results) {
        assert.equal(1, results.length);
        done();
      });
    });

    it('finds using IN clause in string with multiple items', function(done) {
      Post.where('title IN (?)', [['Some Title 1', 'Some Title 2']]).all(function(err, results) {
        assert.equal(2, results.length);
        done();
      });
    });

    it('finds using NOT IN clause with one item', function(done) {
      Post
        .where({'title NOT IN': [['Some Title 1']]})
        .all(function(err, results) {
          assert.equal(3, results.length);
          done();
        });
    });

    it('finds one comment via a basic selector', function(done) {
      Comment.where({ 'comment':'Comment 5' }).one(function(err, comment) {
        assert.equal('Comment 5', comment.comment);
        done();
      });
    });

    it('returns undefined when not found', function(done) {
      Comment.where({ 'comment':'Comment 18' }).one(function(err, comment) {
        assert.equal(undefined, comment);
        done();
      });
    });

    it('finds a post and return alias fields', function(done) {
      Post
        .select('title AS some_alias_title, blurb AS some_alias_blurb')
        .where({ 'id': 1 })
        .one(function(err, row) {
          assert.equal(posts[0].title, row['some_alias_title']);
          assert.equal(posts[0].blurb, row['some_alias_blurb']);
          done();
         });
     });

    it('finds a post and order results descending using aliased columns', function(done) {
        Post.select("title AS some_alias_title, id AS 'some id'")
          .id([1,2])
          .order("id DESC")
          .all(function(err, results) {
            assert.equal(posts[1].id, results[0]['some id']);
            assert.equal(posts[0].id, results[1]['some id']);
            done();
          });
    });

    it('finds last 2 post ids using offset', function(done) {
      Post.select('id').limit(2).offset(2).all(function(err, results) {
        assert.equal(posts[2].id, results[0].id);
        assert.equal(posts[3].id, results[1].id);
        done();
      })
    });

    it('finds with order and limit', function(done) {
      Post.select('id').order('id DESC').limit(1)
        .all(function(err, results) {
          assert.equal(posts[3].id, results[0].id);
          done();
        })
    });

    it('finds with order and offset', function(done) {
      Post.select('id').order('id DESC').limit(3).offset(1)
        .all(function(err, results) {
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[1].id, results[1].id);
          assert.equal(posts[0].id, results[2].id);
          done();
        });
    });

    it('finds with order, offset and limit', function(done) {
      Post.select('id').order('id DESC').limit(2).offset(1)
        .all(function(err, results) {
          console.log(results);
          assert.equal(posts[2].id, results[0].id);
          assert.equal(posts[1].id, results[1].id);
          done();
         });
    });

    it('finds a post with empty blurbs', function(done) {
      var expected = 0;
      _.each(posts, function(post) {
        if (_.isNull(post.blurb) || _.isUndefined(post.blurb)) { expected++; }
      });

      Post.where({blurb: null}).all(function(err, results) {
        assert.equal(expected, results.length);
        done();
      });
    });

    it('should get first page', function(done) {
      Comment.select('id').page(0, 3).all(function(err, rows) {
        assert.equal(3, rows.length);
        assert.equal(1, rows[0].id);
        assert.equal(2, rows[1].id);
        assert.equal(3, rows[2].id);
        done();
      });
    });

    it('should get last page', function(done) {
      Comment.select('id').page(1, 7).all(function(err, rows) {
        assert.equal(2, rows.length);
        assert.equal(8, rows[0].id);
        assert.equal(9, rows[1].id);
        done();
      });
    });
  }); // end Select


  describe("Relations", function() {
    it('should load child of hasOne relationship', function(done) {
      Post.where('id = ?', [1]).load('moreDetails').one(function(err, post) {
        assert.equal(post.moreDetails.extra, 'extra');
        done();
      });
    });

    it('should load child of hasOne relationship with existing rowset', function(done) {
      Post.where('id = ?', [1]).one(function(err, post) {
        Post.load('moreDetails').in(post, function(err) {
          assert.equal(post.moreDetails.extra, 'extra');
          done();
        });
      });
    });

    it('should load the parent of a belongsTo relationship', function(done) {
      Comment.where('id = ?', [1]).load('post').one(function(err, comment) {
        assert.equal(comment.post.title, 'Some Title 1');
        done();
      });
    });

    it('should load hasMany', function(done) {
      Post
        .load('comments')
        .all(function(err, rows) {
          assert.equal(rows[0].comments.length, 2);
          assert.equal(rows[0].comments[0].id, 1);
          assert.equal(rows[0].comments[1].id, 2);
          assert.equal(rows[3].comments.length, 3);
          assert.equal(rows[3].comments[0].id, 7);
          assert.equal(rows[3].comments[1].id, 8);
          assert.equal(rows[3].comments[2].id, 9);
          done();
        });
    });

    it('should load with callback options', function(done) {
      Post
        .select('id, blurb, published')
        .where({'blurb like': '%Some blurb%', published: true})
        .load('comments', function(c) {
          c.select('id, postId, comment')
           .order('id');
        })
        .all(function(err, results) {
          assert.equal(2, results[0].comments.length);
          done();
        });
    });

    it('should get the associated rows of a hasManyThrough relationship', function(done) {
      Post
        .where({id: 1})
        .load("tags")
        .one(function(err, post) {
          assert.equal(post.tags.length, 2);
          assert.equal(post.tags[0].name, 'funny');
          assert.equal(post.tags[1].name, 'coding');
          done();
        });
    });
  }); // end Relations


  describe('Update', function() {
    it('new post title', function(done) {
      Post
        .set({'title': 'Renamed Title'})
        .where({ 'title': 'Some Title 1' })
        .exec(function(err, result) {
          assert.equal(1, result.affectedRows);
          done();
        });
    });

    it('new post title with weird characters', function(done) {
      var newTitle = '"\'pants';
      Post
        .set({title: newTitle})
        .where('id = 4')
        .exec(function(er, results) {
          assert.equal(1, results.affectedRows);
          Post
            .id(4)
            .one(function(er, post) {
              console.log(post);
              assert.equal(newTitle, post.title);
              done();
            });
        });
    });
  }); // end Update


  describe('Delete', function() {

    it('comment by primary key', function(done) {
      Comment.delete().id(8).exec(function(err, results) {
        assert.equal(1, results.affectedRows);
        done();
      });
    });

    it('multiple comments by primary key', function(done) {
      Comment.delete().id([7, 6]).exec(function(err, result) {
        assert.equal(2, result.affectedRows);
        done();
      });
    });

    it('destroy: comment via a basic selector', function(done) {
      Comment.delete().where({comment:'Comment 5'}).exec(function(err, results) {
        assert.equal(1, results.affectedRows);
        done();
      });
    });

    it('destroy: all comments', function(done) {
      Comment.delete().exec(function(err, results) {
        assert.equal(5, results.affectedRows);
        done(err);
      });
    });

    it('destroy: nothing via empty selector', function(done) {
      Comment.delete().exec(function(err, results) {
        assert.equal(0, results.affectedRows);
        done(err);
      });
    });

    it('destroy: error on bad selector', function(done) {
      function test() {
        Comment.delete().where({ 'bad_field': 3 }).exec();
      }

      assert.throws(test, Error);
      done();
    });

  });

}); // end Dao

