// Report HTTP handler: validates inputs and delegates to reporting logic.
import { z } from 'zod';
import { APIResponseInternalErr, APIResponseOK, APIResponseBadRequest } from '../../utils/responseutil.js';
import ReportHdlrImpl from './reporthdlr_impl.js';
import { AuthenticateAccountTokenFromCookie } from '../../utils/tokenutil.js';
import { ErrCodeToObj, GetMyGeofencePermissions } from '../../utils/utils.js';

export default class ReportHdlr {
    constructor(reportSvcI, logger) {
        this.reportHdlrImpl = new ReportHdlrImpl(reportSvcI, logger);
        this.logger = logger;
    }

    RegisterRoutes(router) {
        // All report endpoints require auth and permissions
        router.use(AuthenticateAccountTokenFromCookie);
        router.use(GetMyGeofencePermissions);
        router.post('/alert', this.getGeoAlertReport);
        router.post('/trip', this.getGeoTripReport);
    }

    getGeoAlertReport = async (req, res, next) => {
        try {
            const geoAlertReportSchema = z.object({
                fleetid: z.uuid(),
                ruleids: z.array(z.uuid()).optional(),
                vinnos: z.array(z.string().min(17).max(17)).optional(),
                starttime: z.number(),
                endtime: z.number(),
            });
            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleids, vinnos, starttime, endtime } = this.validateAllInputs(geoAlertReportSchema, req.body);
            const result = await this.reportHdlrImpl.GetGeoAlertReportLogic(accountid, userid, fleetid, ruleids, vinnos, starttime, endtime, permissions);
            APIResponseOK(req, res, result, 'Geo alert report fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    getGeoTripReport = async (req, res, next) => {
        try {
            const geoTripReportSchema = z.object({
                fleetid: z.uuid(),
                ruleids: z.array(z.uuid()).optional(),
                vinnos: z.array(z.string().min(17).max(17)).optional(),
                starttime: z.number(),
                endtime: z.number(),
            });
            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleids, vinnos, starttime, endtime } = this.validateAllInputs(geoTripReportSchema, req.body);
            const result = await this.reportHdlrImpl.GetGeoTripReportLogic(accountid, userid, fleetid, ruleids, vinnos, starttime, endtime, permissions);
            APIResponseOK(req, res, result, 'Geo trip report fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    // Utility: parse with zod schema and produce compact error summary
    validateAllInputs = (schema, data) => {
        try {
            return schema.parse(data);
        } catch (error) {
            if (error.issues && Array.isArray(error.issues)) {
                const allErrors = error.issues.map((err) => {
                    let field = 'root';
                    if (err.path.length > 0) {
                        const lastKey = err.path
                            .slice()
                            .reverse()
                            .find((p) => typeof p === 'string');
                        field = lastKey || err.path.join('.');
                    }

                    return {
                        field: field,
                        errorCode: err.code,
                        message: err.message,
                    };
                });

                let message;
                if (allErrors.length === 1) {
                    message = allErrors[0].message;
                } else if (allErrors.length <= 3) {
                    const errorMessages = allErrors.map((err) => err.message);
                    message = errorMessages.join(', ');
                } else {
                    message = `Please fix ${allErrors.length} validation errors and try again.`;
                }

                throw {
                    errcode: 'INPUT_ERROR',
                    errmsg: message,
                };
            }
            this.logger.error('zod error', error);
            throw {
                errcode: 'ZOD_UTILIZATION_ERROR',
                errmsg: error.toString(),
            };
        }
    };

    // Centralized mapping to API error responses
    handleError = (req, res, error) => {
        if (error.errcode === 'INPUT_ERROR') {
            APIResponseBadRequest(req, res, error.errcode, null, error.errmsg);
        } else if (error.errcode === 'INVALID_RULE_TYPE') {
            APIResponseBadRequest(req, res, error.errcode, null, error.errmsg);
        } else if (error.errcode) {
            const errObj = ErrCodeToObj(error.errcode);
            errObj.func(req, res, errObj.errcode, null, errObj.msg);
        } else {
            APIResponseInternalErr(req, res, 'INTERNAL_ERROR', null, 'Something went wrong');
        }
    };
}
