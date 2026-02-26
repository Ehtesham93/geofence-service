// Health endpoint: exposes liveness/readiness information via service.
import { APIResponseBadRequest, APIResponseError, APIResponseInternalErr, APIResponseOK } from '../../utils/responseutil.js';

export default class HealthHdlr {
    constructor(healthSvcI) {
        this.healthSvcI = healthSvcI;
    }

    GetHealthStatus = async (req, res, next) => {
        try {
            const healthStatus = this.healthSvcI.GetHealthStatus();
            APIResponseOK(req, res, healthStatus, 'Health Status Ready!');
        } catch (e) {
            APIResponseInternalErr(req, res, 'HEALTH_STATUS_ERR', e.toString(), 'health status query failed');
        }
    };

    RegisterRoutes(router) {
        // Simple liveness probe
        router.get('/check', this.GetHealthStatus);
    }
}
