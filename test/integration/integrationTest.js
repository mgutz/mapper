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
      function(cb) { PostTag.truncate().exec(cb); },
      function(cb) { MoreDetail.truncate().exec(cb); },
      function(cb) { Comment.truncate().exec(cb); },
      function(cb) { Tag.truncate().exec(cb); },
      function(cb) { Post.truncate().exec(cb); },

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


    it('finds a post with populated comments', function(done) {
      Post
        .where({id: posts[0].id})
        .populate('comments')
        .one(function(err, row) {
          assert.equal(row.comments.length, 2);
          done();
        });
    });


    it('finds all posts with populated comments', function(done) {
      Post
        .populate('comments')
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

    it('finds a post with options for populated relation', function(done) {
      Post
        .select('id, blurb')
        .where({'blurb like': '%Some blurb%'})
        .populate('comments', function(c) {
          c.select('id, postId, published')
            .where({published: true})
            .orderBy('id');
        })
        .all(function(err, results) {
          assert.equal(2, results[0].comments.length);
          done();
        });
    });

  }); // end Select


  describe("Relations", function() {
    it('should find child of hasOne relationship');
    it('should get the parent of a belongsTo relationship');
    it('should get the associated rows of a hasMany relationship');
    it('should get the associated rows of a hasManyThrough relationship');
  }); // end Relations

}); // end Dao

