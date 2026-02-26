// Report service: selects appropriate ClickHouse/Postgres queries via DB layer.
import ReportSvcDB from './reportsvc_db.js';

export default class ReportSvc {
    // chClientI: ClickHouse client; pgPoolI: Postgres pool; logger/config: runtime
    constructor(chClientI, pgPoolI, logger, config) {
        this.reportSvcDB = new ReportSvcDB(chClientI, pgPoolI, logger, config);
        this.logger = logger;
    }

    async GetGeoAlertReport(accountId, userId, fleetId, ruleids, vinnos, starttime, endtime) {
        try {
            if (vinnos?.length > 0) {
                return await this.reportSvcDB.getGeoAlertVehReport(accountId, userId, fleetId, vinnos, starttime, endtime);
            } else if (ruleids?.length > 0) {
                return await this.reportSvcDB.getGeoAlertRuleReport(accountId, userId, fleetId, ruleids, starttime, endtime);
            } else {
                throw {
                    errcode: 'INVALID_INPUT',
                };
            }
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR'
                };
            }
        }
    }

    async GetGeoTripReport(accountId, userId, fleetId, ruleids, vinnos, starttime, endtime) {
        try {
            if (vinnos?.length > 0) {
                return await this.reportSvcDB.getGeoTripVehReport(accountId, userId, fleetId, vinnos, starttime, endtime);
            } else if (ruleids?.length > 0) {
                return await this.reportSvcDB.getGeoTripRuleReport(accountId, userId, fleetId, ruleids, starttime, endtime);
            } else {
                throw {
                    errcode: 'INVALID_INPUT',
                };
            }
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR'
                };
            }
        }
    }

    //utils
    async GetUserFleets(accountid, userid) {
        try {
            return await this.reportSvcDB.getUserFleets(accountid, userid);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_ERROR',
            };
        }
    }
}
