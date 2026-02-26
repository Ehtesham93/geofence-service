import { CheckUserPerms } from '../../utils/utils.js';
export default class ReportHdlrImpl {
    constructor(reportSvcI, logger) {
        this.reportSvcI = reportSvcI;
        this.logger = logger;
    }

    async GetGeoAlertReportLogic(accountId, userId, fleetId, ruleids, vinnos, starttime, endtime, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.rule.admin', 'geofence.reports.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'ALERT_REPORT_PERM_DENIED'
                    }
                }
            }
            return await this.reportSvcI.GetGeoAlertReport(accountId, userId, fleetId, ruleids, vinnos, starttime, endtime);
        } catch (error) {
            throw error;
        }
    }

    async GetGeoTripReportLogic(accountId, userId, fleetId, ruleids, vinnos, starttime, endtime, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.rule.admin', 'geofence.reports.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'TRIP_REPORT_PERM_DENIED'
                    }
                }
            }
            return await this.reportSvcI.GetGeoTripReport(accountId, userId, fleetId, ruleids, vinnos, starttime, endtime);
        } catch (error) {
            throw error;
        }
    }

    //support
    async UserFleetValidationLogic(accountId, userId, fleetId) {
        try {
            const fleets = await this.reportSvcI.GetUserFleets(accountId, userId);
            if (!fleets) {
                return false;
            }
            return fleets.includes(fleetId);
        } catch (error) {
            throw error;
        }
    }
}
