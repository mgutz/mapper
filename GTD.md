# Get Things Done


## SQL




## One to Many

A post has many comments:

    PostDao = Mapper.Dao("posts");
    CommentDao = Mapper.Dao("comments");

    PostDao.many("comments", CommentDao, "post_id");
    CommentDao.one("post", PostDao, "post_id");


## Many to Many




## Many through
