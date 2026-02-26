import pg from "pg";
import FabErr from "./faberr.js";

export const ErrConnect = new FabErr("ERR_CONNECT", null, "db connect error");
export const ErrTXNRollback = new FabErr(
  "ERR_TXN_ROLLBACK",
  null,
  "txn rollback error"
);
export const ErrTXNExec = new FabErr("ERR_TXN_EXEC", null, "txn exec error");

export class PgPool {
  constructor(pgcfg, logger) {
    this.logger = logger;
    this.Pool = new pg.Pool({
      user: pgcfg.user,
      host: pgcfg.host,
      port: pgcfg.port,
      database: pgcfg.database,
      password: pgcfg.password,
      min: 2,
      max: 5,
      statement_timeout: 30 * 1000,
    });
    this.Pool.on("connect", (client) => {
      client.query("SET search_path TO " + pgcfg.schema + ",public");
    });
  }

  async Query(...args) {
    return this.Pool.query(...args);
  }

  async RunTransaction(queryfn) {
    let client = null;
    try {
      client = await this.Pool.connect();
    } catch (e) {
      this.logger.error(e);
      return [null, ErrConnect];
    }
    try {
      await client.query("BEGIN");
      const funcres = await queryfn(client);
      await this.TxRollback(client);
      return funcres;
    } catch (e) {
      //   console.log("Tx Exec err:", e.toString());
      //   console.log(e);
      const rollbackerr = await this.TxRollback(client);
      if (rollbackerr != null) {
        this.logger.error(rollbackerr);
        return [null, ErrTXNRollback];
      }
      this.logger.error(e);
      return [null, ErrTXNExec];
    } finally {
      client.release();
    }
  }

  async TxCommit(client) {
    try {
      await client.query("COMMIT");
    } catch (e) {
      return e;
    }
    return null;
  }

  async TxRollback(client) {
    try {
      await client.query("ROLLBACK");
    } catch (e) {
      return e;
    }
    return null;
  }

  async End() {
    try {
      await this.Pool.end();
    } catch (e) {
      return e;
    }
    return null;
  }
}
