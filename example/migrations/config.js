// To migrate a schema based on an environment, run
//
//  NODE_ENV=development schema up
module.exports = {
  development: {
    mysql: { user: 'mapper', password: 'password', database: 'mapper_example' }
  },

  test: {
    mysql: { user: 'mapper', password: 'password', database: 'mapper_example' }
  },


  production: {
    mysql: { user: 'mapper', password: 'password', database: 'mapper_example' }
  }
};
