#!/bin/sh

# Creates the mapper_example which is used by integration test.
mysql -p -u root <<-EOF

-- Re-create database as needed.
drop database  mapper_example;

create database mapper_example;
grant all privileges on mapper_example.*
to 'mapper'@'localhost' identified by 'password';

EOF
