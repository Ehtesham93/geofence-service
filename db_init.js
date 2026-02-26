// Initializes a Postgres database for geofence service:
// - Connects with admin credentials
// - Creates target database if missing
// - Creates role/user (via DO block) if missing
// - Creates schema and grants
// - Enables required extensions
// - Verifies login with target user
// NOTE: This script performs administrative operations; ensure network/creds permit.
import pg from "pg";
main();
async function main() {
  if (process.argv.length < 11) {
    console.log(
      "Run as node db_init.js localhost 5432 lmmintellicar postgres Classic@73093 lmmintellicar geofencesch postgres Classic@73093"
    );
    console.log(
      "Ex: node db_init.js 127.0.0.1 5432 apiuser apiuser <ROOTPASSWORD> ione ionesch ioneuser <TARGETUSERPASSWORD>"
    );
    process.exit(1);
  }

  // console.log(process.argv.length);

  const pghost = process.argv[2];
  const pgport = process.argv[3];
  const pgdb = process.argv[4];
  const pguser = process.argv[5];
  const pgpassword = process.argv[6];
  const targetdb = process.argv[7];
  const targetschema = process.argv[8];
  const targetusername = process.argv[9];
  const targetpassword = process.argv[10];

  console.log(
    "Connecting to pghost at " +
    pghost +
    ":" +
    pgport +
    " db:" +
    pgdb +
    ", with user:" +
    pguser
  );

  console.log(
    "Going to create db:" +
    targetdb +
    "(" +
    targetschema +
    ")" +
    ", with targetuser:" +
    targetusername +
    "(" +
    targetpassword +
    ")"
  );

  let pgclient = new pg.Client({
    user: pguser,
    host: pghost,
    database: pgdb,
    password: pgpassword,
    port: pgport,
  });

  // 1. First connect to the db create the target database...
  try {
    await pgclient.connect();
    console.log("DB Connected...");
  } catch (error) {
    console.log("Connect failed", error);
    process.exit(1);
  }

  // 2. Create the database...
  try {
    // 2.1 Create database...
    const dblistres = await pgclient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetdb]
    );
    if (dblistres.rowCount === 0) {
      await pgclient.query('CREATE DATABASE ' + targetdb);
    }
    console.log("1. Database created..");

    await pgclient.end();
    pgclient = new pg.Client({
      user: pguser,
      host: pghost,
      database: targetdb,
      password: pgpassword,
      port: pgport,
    });
    await pgclient.connect();

    // 2.2 Create user...
    // Postgres doesn't support CREATE USER IF NOT EXISTS, so use DO block
    await pgclient.query(
      "DO $$ BEGIN " +
      "IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '" + targetusername + "') THEN " +
      "   CREATE USER " + targetusername + " WITH PASSWORD '" + targetpassword + "'; " +
      "END IF; " +
      "END $$;"
    );
    console.log("2. User created..");

    // 3.1 Create schema..
    await pgclient.query("CREATE SCHEMA IF NOT EXISTS " + targetschema);
    await pgclient.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");

    // 3.2 Grant schema permission to user...
    await pgclient.query(
      "GRANT ALL ON SCHEMA " + targetschema + " TO " + targetusername
    );
    await pgclient.query("GRANT USAGE ON SCHEMA public TO " + targetusername);

    console.log("3. Schema created..");

    // 4. Create all the extensions required at the database level...
    // 4.1 Enable uuid...
    await pgclient.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 5. Relogin with the given user...
    await pgclient.end();
    pgclient = new pg.Client({
      user: targetusername,
      host: pghost,
      database: targetdb,
      password: targetpassword,
      port: pgport,
    });
    await pgclient.connect();

    // 5. Check the given user login...
    const nowres = await pgclient.query("select NOW()");
    if (nowres.rowCount == 0) {
      // Some failure..
      process.exit(1);
    }
  } catch (error) {
    console.log("Create target db/schema/user failed", error);
  }
  // X. Close the pgclient connection...
  await pgclient.end();
  console.log("DB Disconnected...");
  process.exit(0);
}
