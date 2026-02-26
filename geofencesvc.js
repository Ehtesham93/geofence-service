//geofencesvc.js
// Geofence service: thin façade that delegates to DB layer and normalizes errors.
import GeofenceSvcDB from './geofencesvc_db.js';

export default class GeofenceSvc {
    // pgPoolI: Postgres pool; logger: structured logger; config: runtime settings
    constructor(pgPoolI, logger, config) {
        this.geofenceSvcDB = new GeofenceSvcDB(pgPoolI, logger, config);
        this.logger = logger;
    }

    async CreateGeofence(accountId, userId, fleetId, geofenceName, geofenceInfo, meta) {
        try {
            return await this.geofenceSvcDB.createGeofence(accountId, userId, fleetId, geofenceName, geofenceInfo, meta);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async CreateGeofenceWithRule(accountId, userId, fleetId, geofenceName, geofenceInfo, meta, rule, vehicles) {
        try {
            return await this.geofenceSvcDB.createGeofenceWithRule(accountId, userId, fleetId, geofenceName, 
                geofenceInfo, meta, rule, vehicles);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async GetGeofence(accountId, fleetIds) {
        try {
            return await this.geofenceSvcDB.getGeofence(accountId, fleetIds);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async GetGeofenceById(accountId, userId, fleetId, geofenceId) {
        try {
            return await this.geofenceSvcDB.getGeofenceById(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async GetGeofencesWithActionInfo(accountId, userId, fleetId) {
        try {
            return await this.geofenceSvcDB.getGeofencesWithActionInfo(accountId, userId, fleetId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async UpdateGeofence(accountId, userId, fleetId, geofenceId, geofenceName, geofenceInfo, meta) {
        try {
            return await this.geofenceSvcDB.updateGeofence(accountId, userId, fleetId, geofenceId, geofenceName, geofenceInfo, meta);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async UpdateGeofenceStateWithRule(accountId, userId, fleetId, geofenceId, ruleId, isActive) {
        try {
            return await this.geofenceSvcDB.updateGeofenceStateWithRule(accountId, userId, fleetId, geofenceId, ruleId, isActive);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async UpdateGeofenceState(accountId, userId, fleetId, geofenceId, isActive) {
        try {
            return await this.geofenceSvcDB.updateGeofenceState(accountId, userId, fleetId, geofenceId, isActive);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async DeleteGeofence(accountId, userId, fleetId, geofenceId) {
        try {
            return await this.geofenceSvcDB.deleteGeofence(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async DeleteGeofenceWithRule(accountId, userId, fleetId, geofenceId, ruleId) {
        try {
            return await this.geofenceSvcDB.deleteGeofenceWithRule(accountId, userId, fleetId, geofenceId, ruleId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListGeoRules(accountId, userId, fleetId, geofenceId) {
        try {
            return await this.geofenceSvcDB.listGeoRules(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListRuleTypes() {
        try {
            return await this.geofenceSvcDB.listRuleTypes();
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListActionTypes() {
        try {
            return await this.geofenceSvcDB.listActionTypes();
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async CreateRule(accountId, userId, fleetId, rule) {
        try {
            return await this.geofenceSvcDB.createRule(accountId, userId, fleetId, rule);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListRules(accountId, userId, fleetIds) {
        try {
            return await this.geofenceSvcDB.listRules(accountId, userId, fleetIds);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async GetRuleById(accountId, userId, fleetId, ruleId) {
        try {
            return await this.geofenceSvcDB.getRuleById(accountId, userId, fleetId, ruleId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async UpdateRule(accountId, userId, fleetId, ruleId, ruleName, ruleTypeId, meta, ruleGeoInfo) {
        try {
            return await this.geofenceSvcDB.updateRule(accountId, userId, fleetId, ruleId, ruleName, ruleTypeId, meta, ruleGeoInfo);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async UpdateRuleState(accountId, userId, fleetId, ruleId, isActive) {
        try {
            return await this.geofenceSvcDB.updateRuleState(accountId, userId, fleetId, ruleId, isActive);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async DeleteRule(accountId, userId, fleetId, ruleId) {
        try {
            return await this.geofenceSvcDB.deleteRule(accountId, userId, fleetId, ruleId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListAsinablRuleVehs(accountId, userId, fleetIds, ruleId) {
        try {
            return await this.geofenceSvcDB.listAsinablRuleVehs(accountId, userId, fleetIds, ruleId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListAsinablRuleFleets(accountId, userId, fleetIds, ruleId) {
        try {
            return await this.geofenceSvcDB.listAsinablRuleFleets(accountId, userId, fleetIds, ruleId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async ListAsinablRuleUsers(accountId, userId, fleetIds, ruleId) {
        try {
            return await this.geofenceSvcDB.listAsinablRuleUsers(accountId, userId, fleetIds, ruleId);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async AddRuleVehs(accountId, userId, fleetId, ruleId, vinnos) {
        try {
            return await this.geofenceSvcDB.addRuleVehs(accountId, userId, fleetId, ruleId, vinnos);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async DeleteRuleVehs(accountId, userId, fleetId, ruleId, vinnos) {
        try {
            return await this.geofenceSvcDB.deleteRuleVehs(accountId, userId, fleetId, ruleId, vinnos);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async AddRuleFleets(accountId, userId, fleetId, ruleId, fleets, cookie) {
        try {
            return await this.geofenceSvcDB.addRuleFleets(accountId, userId, fleetId, ruleId, fleets, cookie);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async DeleteRuleFleets(accountId, userId, fleetId, ruleId, fleets) {
        try {
            return await this.geofenceSvcDB.deleteRuleFleets(accountId, userId, fleetId, ruleId, fleets);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async AddRuleUsers(accountId, userId, fleetId, ruleId, users, alertmeta) {
        try {
            return await this.geofenceSvcDB.addRuleUsers(accountId, userId, fleetId, ruleId, users, alertmeta);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async UpdateUserNoti(accountId, userIdAuth, fleetId, ruleId, userId, alertmeta) {
        try {
            return await this.geofenceSvcDB.updateUserNoti(accountId, userIdAuth, fleetId, ruleId, userId, alertmeta);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    async DeleteRuleUsers(accountId, userId, fleetId, ruleId, users) {
        try {
            return await this.geofenceSvcDB.deleteRuleUsers(accountId, userId, fleetId, ruleId, users);
        } catch (error) {
            if (error.errcode) {
                throw error;
            } else {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        }
    }

    //utils
    async GetRecursiveFleets(accountId, fleetId, cookie, recursive = false) {
        try {
            return await this.geofenceSvcDB.getRecursiveFleets(accountId, fleetId, cookie, recursive);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_ERROR',
            };
        }
    }

    async GetUserFleets(accountid, userid) {
        try {
            return await this.geofenceSvcDB.getUserFleets(accountid, userid);
        } catch (error) {
            throw {
                errcode: 'INTERNAL_ERROR',
            };
        }
    }
}
