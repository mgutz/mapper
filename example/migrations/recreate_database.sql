#!/bin/sh

mysql -p -u root <<-EOF

-- Re-create database as needed.
drop database  mapper_example;

create database mapper_example;
grant all privileges on mapper_example.*
to 'mapper'@'localhost' identified by 'password';


use mapper_example;


DROP PROCEDURE IF EXISTS `mygrate__drop_index_if_exists`;

DELIMITER $$
CREATE PROCEDURE `mygrate__drop_index_if_exists`(IN `database` varchar(64), IN `table` varchar(64), IN `index` varchar(64))
    MODIFIES SQL DATA
    DETERMINISTIC
    COMMENT 'Drops an index, if it exists and the table exists'
BEGIN
    SET @findTable=CONCAT('SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = "', `database`, '" AND TABLE_NAME = "', `table`, '"');
    SET @findIndex=CONCAT('SHOW INDEXES FROM `',`database`,'`.`',`table`,'` WHERE Key_name = "',`index`,'"');
    SET @dropIndex=CONCAT('ALTER TABLE `',`database`,'`.`',`table`,'` DROP KEY `',`index`,'`');
    SET @msgMissingTable=CONCAT('SELECT "Table `', `database`, '`.`', `table`, '` does not exist" AS `Message`');
    SET @msgMissingIndex=CONCAT('SELECT "Index `', `database`, '`.`', `table`, '`.`', `index`, '` does not exist" AS `Message`');

    PREPARE findTable FROM @findTable;
    PREPARE findIndex FROM @findIndex;
    PREPARE dropIndex FROM @dropIndex;
    PREPARE msgMissingTable FROM @msgMissingTable;
    PREPARE msgMissingIndex FROM @msgMissingIndex;

    EXECUTE findTable;
    SET @found=FOUND_ROWS();

    IF (@found > 0 )
    THEN
        EXECUTE findIndex;
        SET @found=FOUND_ROWS();

        IF (@found > 0 )
        THEN
            EXECUTE dropIndex;
        ELSE
            EXECUTE msgMissingIndex;
        END IF;
    ELSE
        EXECUTE msgMissingTable;
    END IF;


    DEALLOCATE PREPARE findTable;
    DEALLOCATE PREPARE findIndex;
    DEALLOCATE PREPARE dropIndex;
    DEALLOCATE PREPARE msgMissingTable;
    DEALLOCATE PREPARE msgMissingIndex;
END$$

DELIMITER ;

EOF
