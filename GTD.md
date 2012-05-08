# Get Things Done

## SQL


## Dao Configuration

    PostDao = Mapper.map("posts");
    CommentDao = Mapper.map("comments");

    PostDao.many("comments", CommentDao, "postId");
    CommentDao.one("post", PostDao, "postId");


## Has Many



A post has many comments


## Many to Many


## Many through
