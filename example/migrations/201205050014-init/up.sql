source ./comments.sql

-- A posting.
create table if not exists Posts (
  id integer not null primary key,
  title varchar(255) not null,
  blurb varchar(255),
  body text NOT NULL,
  published boolean,
  createdAt date,
  updatedAt date
);

-- Tag for a posting.
create table if not exists Tags (
  -- purposely go against convention to use primaryKey option
  tagId integer auto_increment not null primary key,
  name varchar(32),
  createdAt date
);


-- Posts have many tags.
-- Tags belong to many posts.
create table if not exists PostsTags (
  id integer auto_increment primary key,
  postId integer not null references post(id),
  tagId integer not null references tag(id),
  constraint u_postId_tagId unique (postId, tagId)
);

