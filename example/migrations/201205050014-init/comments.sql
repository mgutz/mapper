-- Comments belong to a post.
create table if not exists Comments (
  id integer not null primary key,
  postId integer not null,
  comment text not null,
  createdAt date
);
