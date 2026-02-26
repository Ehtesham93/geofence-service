import * as wrappers from '../../utils/wrappers.js';
import { v4 as uuidv4 } from 'uuid';

export default class GeofenceSvcUtils {
    constructor(logger, config) {
        this.logger = logger;
        this.config = config;
        this.cookieJar = new Map();
        this.cookieFetchDate = new Map();
    }

    getUUID() {
        return uuidv4();
    }

    async getRecursiveFleets(accountId, fleetId, cookie, recursive = false) {
        try {
            const response = await wrappers.externalApiCall(`/api/v1/fms/account/fleet/${fleetId}/subfleets?recursive=${recursive}`, {}, 'GET', cookie);
            const subFleets = response?.data?.map((fleet) => fleet?.fleetid);
            const fleetIds = [fleetId, ...subFleets];
            return fleetIds;
        } catch (error) {
            throw error;
        }
    }

    async getAccountFleets(cookie) {
        try {
            const response = await wrappers.externalApiCall(`/api/v1/fms/account/fleets`, {}, 'GET', cookie);
            return response?.data?.map((fleet) => fleet?.fleetid) || [];
        } catch (error) {
            throw error;
        }
    }
}
