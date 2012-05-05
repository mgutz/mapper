/**
 * Connect to the database.
 */
var Mapper = require("../"),
  Config = require("./migrations/config"),
  env = process.env.NODE_ENV || "development",
  config = Config[env].mysql;

Mapper.connect(config);

// Declare the data access object.
var Post = Mapper.Dao("posts");
var Comment = Mapper.Dao("comments");
var Tag = Mapper.Dao("tags", "tagId");
var PostTag = Mapper.Dao("postsTags");

// Post has many comments of type Comment via Comments.postId
Post.hasMany("comments", Comments, "postId");

// Post has many tags of type Tag through PostTag.postId
Post.hasMany("tags", Tag, [PostTag, "postId"]);

// Comment belong to a post via Post.postId
Comment.belongsTo("post", Post, "postId");


        Post.select({ 'blurb.like': '%Some blurb%' }, {
          only: ['id', 'blurb'],
          include: {
            'comments': {
              where: {'published': true },
              only: ['id', 'post_id', 'published'],
              order: ['id']
            }
          }
        }, function(err, results) {

// simple lookup
Post
  .select("foo, bar, other")
  .where("foo = ? and something = ?", foo, bar)
  .orderBy("foo")
  .limit()
  .offset()
  .page(1, 3)
  .fetch("comments", function(col) { col.select().where().one() })
  .one();

Post
  .select("foo, bar, other")
  .where({ foo: 'asdf', bar: ''});
  .page(1, 3)
  .fetch("comments", function(col) { col.select().where().one() })
  .one();









// more complicated
Post.exec("asfadf").populate("comments").populate().scalar();
Post.exec("asfadf").all();
Post.exec("asfadf").one();
Post.exec("asfadf").nil();


