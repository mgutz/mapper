# FAQ

Q. How to view the SQL being sent to the server?

A. Pass in `verbose` option when connecting.

    Mapper.connect(conn, {verbose: true});


Q. How to do prepared statements?

A. Unfortunately, this has not been implemented in the driver. For now,
   use pseudo-bindings with `'?'` placeholders to bind locals.

    Post.where('blurb like ?', ['%foo%'], cb);


Q. What about validations?

A. I put validations in a separate module to be shared with client code.


Q. What about migrations?

A. See [mygrate](https://github.com/mgutz/mygrate), an external migration
utility for MySQL and PostgreSQL ot tied to an ORM.


