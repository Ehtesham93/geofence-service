// Geofence business logic adapter: applies access checks and calls service layer.
import { CheckUserPerms } from '../../utils/utils.js';

export default class GeofenceHdlrImpl {
    // geofenceSvcI: service with persistence and external calls. logger: structured logger
    constructor(geofenceSvcI, logger) {
        this.geofenceSvcI = geofenceSvcI;
        this.logger = logger;
    }

    async CreateGeofenceLogic(accountId, userId, fleetId, geofenceName, geofenceInfo, meta, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'CREATE_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.CreateGeofence(accountId, userId, fleetId, geofenceName, geofenceInfo, meta);
        } catch (error) {
            throw error;
        }
    }

    async CreateGeofenceWithRuleLogic(accountId, userId, fleetId, geofenceName, geofenceInfo, meta, rule, vehicles, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'CREATE_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.CreateGeofenceWithRule(accountId, userId, fleetId, geofenceName, geofenceInfo, meta, rule, vehicles);
        } catch (error) {
            throw error;
        }
    }

    async GetGeofenceLogic(accountId, userId, fleetId, recursive = false,  cookie, permissions) {
        try {

            //i) user fleet access validation 
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);

            //if is not valid means user has no fleet access
            if (!isValid) { 
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }

            //ii) permission check if not admin 
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.geofence.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'LIST_GEOFENCES_PERMISSION_DENIED'  
                    }
                }
            }

            //iii) ecursive fleets logic 
            const fleetIds = recursive ? await this.geofenceSvcI.GetRecursiveFleets(accountId, fleetId, cookie, true) : [fleetId];

            //and finally fetch geofence --> it start db side and and through server layer 
            return await this.geofenceSvcI.GetGeofence(accountId, fleetIds);
        } catch (error) {
            throw error;
        }
    }

    
    async GetGeofenceByIdLogic(accountId, userId, fleetId, geofenceId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.geofence.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'GET_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.GetGeofenceById(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            throw error;
        }
    }

    async GetGeofencesWithActionInfoLogic(accountId, userId, fleetId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }

            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.geofence.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'GET_GEOFENCES_WITH_ACTION_INFO_PERMISSION_DENIED'
                    }
                }
            }

            return await this.geofenceSvcI.GetGeofencesWithActionInfo(accountId, userId, fleetId);
        } catch (error) {
            throw error;
        }
    }

    async UpdateGeofenceLogic(accountId, userId, fleetId, geofenceId, geofenceName, geofenceInfo, meta, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'UPDATE_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }

            return await this.geofenceSvcI.UpdateGeofence(accountId, userId, fleetId, geofenceId, geofenceName, geofenceInfo, meta);
        } catch (error) {
            throw error;
        }
    }

    async UpdateGeofenceStateWithRuleLogic(accountId, userId, fleetId, geofenceId, ruleId, isActive, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'UPDATE_GEOFENCE_STATE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.UpdateGeofenceStateWithRule(accountId, userId, fleetId, geofenceId, ruleId, isActive);
        } catch (error) {
            throw error;
        }
    }

    async UpdateGeofenceStateLogic(accountId, userId, fleetId, geofenceId, isActive, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'UPDATE_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.UpdateGeofenceState(accountId, userId, fleetId, geofenceId, isActive);
        } catch (error) {
            throw error;
        }
    }

    async DeleteGeofenceLogic(accountId, userId, fleetId, geofenceId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'DELETE_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.DeleteGeofence(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            throw error;
        }
    }

    async DeleteGeofenceWithRuleLogic(accountId, userId, fleetId, geofenceId, ruleId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'DELETE_GEOFENCE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.DeleteGeofenceWithRule(accountId, userId, fleetId, geofenceId, ruleId);
        } catch (error) {
            throw error;
        }
    }

    async ListGeoRulesLogic(accountId, userId, fleetId, geofenceId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.geofence.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'LIST_GEO_RULES_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.ListGeoRules(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            throw error;
        }
    }

    async ListRuleTypesLogic() {
        try {
            return await this.geofenceSvcI.ListRuleTypes();
        } catch (error) {
            throw error;
        }
    }

    async ListActionTypesLogic() {
        try {
            return await this.geofenceSvcI.ListActionTypes();
        } catch (error) {
            throw error;
        }
    }

    async CreateRuleLogic(accountId, userId, fleetId, rule, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'CREATE_RULE_PERMISSION_DENIED'
                    }
                }
            }

            if (rule.ruletypeid === this.ruleTypes.Trip) {
                if (rule.rulegeoinfo[0]?.actiontypeid === this.actionTypes.EntryExit || rule.rulegeoinfo[1]?.actiontypeid === this.actionTypes.EntryExit) {
                    throw {
                        errcode: 'INVALID_RULE_TYPE',
                        errmsg: 'Type ENTRY_EXIT is not allowed for Trip rule',
                    };
                }
                if (rule.rulegeoinfo[0]?.actiontypeid === this.actionTypes.Exit && rule.rulegeoinfo[1]?.actiontypeid === this.actionTypes.Exit) {
                    throw {
                        errcode: 'INVALID_RULE_TYPE',
                        errmsg: 'Exit and Exit combination is not allowed',
                    };
                }
                if (rule.rulegeoinfo[0]?.geofenceid === rule.rulegeoinfo[1]?.geofenceid) {
                    if (rule.rulegeoinfo[0]?.actiontypeid === this.actionTypes.Entry && rule.rulegeoinfo[1]?.actiontypeid === this.actionTypes.Entry) {
                        throw {
                            errcode: 'INVALID_RULE_TYPE',
                            errmsg: 'Entry and Entry combination is not allowed for same geofence',
                        };
                    }
                }
                if (rule.rulegeoinfo[0]?.geofenceid !== rule.rulegeoinfo[1]?.geofenceid) {
                    if (
                        (rule.rulegeoinfo[0]?.actiontypeid === this.actionTypes.Exit && rule.rulegeoinfo[1]?.actiontypeid === this.actionTypes.Entry) ||
                        (rule.rulegeoinfo[0]?.actiontypeid === this.actionTypes.Entry && rule.rulegeoinfo[1]?.actiontypeid === this.actionTypes.Exit)
                    ) {
                        throw {
                            errcode: 'INVALID_RULE_TYPE',
                            errmsg: 'Entry and Exit or Exit and Entry combination is not allowed for different geofences',
                        };
                    }
                }
            }
            return await this.geofenceSvcI.CreateRule(accountId, userId, fleetId, rule);
        } catch (error) {
            throw error;
        }
    }

    async ListRulesLogic(accountId, userId, fleetId, recursive = false, cookie, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin', 'geofence.rule.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'LIST_RULES_PERMISSION_DENIED'
                    }
                }
            }
            const fleetIds = recursive ? await this.geofenceSvcI.GetRecursiveFleets(accountId, fleetId, cookie, true) : [fleetId];
            return await this.geofenceSvcI.ListRules(accountId, userId, fleetIds);
        } catch (error) {
            throw error;
        }
    }

    async GetRuleByIdLogic(accountId, userId, fleetId, ruleId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin', 'geofence.rule.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'GET_RULE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.GetRuleById(accountId, userId, fleetId, ruleId);
        } catch (error) {
            throw error;
        }
    }

    async UpdateRuleLogic(accountId, userId, fleetId, ruleId, ruleName, ruleTypeId, meta, ruleGeoInfo, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'UPDATE_RULE_PERMISSION_DENIED'
                    }
                }
            }
            if (ruleTypeId === this.ruleTypes.Trip) {
                if (ruleGeoInfo[0]?.actiontypeid === this.actionTypes.EntryExit || ruleGeoInfo[1]?.actiontypeid === this.actionTypes.EntryExit) {
                    throw {
                        errcode: 'INVALID_RULE_TYPE',
                        errmsg: 'Type ENTRY_EXIT is not allowed for Trip rule',
                    };
                }
                if (ruleGeoInfo[0]?.actiontypeid === this.actionTypes.Exit && ruleGeoInfo[1]?.actiontypeid === this.actionTypes.Exit) {
                    throw {
                        errcode: 'INVALID_RULE_TYPE',
                        errmsg: 'Exit and Exit combination is not allowed',
                    };
                }
                if (ruleGeoInfo[0]?.geofenceid === ruleGeoInfo[1]?.geofenceid) {
                    if (ruleGeoInfo[0]?.actiontypeid === this.actionTypes.Entry && ruleGeoInfo[1]?.actiontypeid === this.actionTypes.Entry) {
                        throw {
                            errcode: 'INVALID_RULE_TYPE',
                            errmsg: 'Entry and Entry combination is not allowed for same geofence',
                        };
                    }
                }
                if (ruleGeoInfo[0]?.geofenceid !== ruleGeoInfo[1]?.geofenceid) {
                    if (
                        (ruleGeoInfo[0]?.actiontypeid === this.actionTypes.Exit && ruleGeoInfo[1]?.actiontypeid === this.actionTypes.Entry) ||
                        (ruleGeoInfo[0]?.actiontypeid === this.actionTypes.Entry && ruleGeoInfo[1]?.actiontypeid === this.actionTypes.Exit)
                    ) {
                        throw {
                            errcode: 'INVALID_RULE_TYPE',
                            errmsg: 'Entry and Exit or Exit and Entry combination is not allowed for different geofences',
                        };
                    }
                }
            }
            return await this.geofenceSvcI.UpdateRule(accountId, userId, fleetId, ruleId, ruleName, ruleTypeId, meta, ruleGeoInfo);
        } catch (error) {
            throw error;
        }
    }

    async UpdateRuleStateLogic(accountId, userId, fleetId, ruleId, isActive, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'UPDATE_RULE_STATE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.UpdateRuleState(accountId, userId, fleetId, ruleId, isActive);
        } catch (error) {
            throw error;
        }
    }

    async DeleteRuleLogic(accountId, userId, fleetId, ruleId, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'DELETE_RULE_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.DeleteRule(accountId, userId, fleetId, ruleId);
        } catch (error) {
            throw error;
        }
    }

    async ListAsinablRuleVehsLogic(accountId, userId, fleetId, ruleId, recursive = false, cookie, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin', 'geofence.rule.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'LIST_ASSIGNABLE_RULE_PERMISSION_DENIED'
                    }
                }
            }
            const fleetIds = recursive ? await this.geofenceSvcI.GetRecursiveFleets(accountId, fleetId, cookie, true) : [fleetId];
            return await this.geofenceSvcI.ListAsinablRuleVehs(accountId, userId, fleetIds, ruleId);
        } catch (error) {
            throw error;
        }
    }

    async ListAsinablRuleFleetsLogic(accountId, userId, fleetId, ruleId, recursive = false, cookie, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin', 'geofence.rule.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'LIST_ASIGN_RULE_FLEETS_PERM_DENIED'
                    }
                }
            }
            const fleetIds = recursive ? await this.geofenceSvcI.GetRecursiveFleets(accountId, fleetId, cookie, true) : [fleetId];
            return await this.geofenceSvcI.ListAsinablRuleFleets(accountId, userId, fleetIds, ruleId);
        } catch (error) {
            throw error;
        }
    }

    async ListAsinablRuleUsersLogic(accountId, userId, fleetId, ruleId, recursive = false, cookie, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin', 'geofence.rule.view']);
                if (!hasPerms) {
                    throw {
                        errcode: 'LIST_ASIGN_RULE_USERS_PERM_DENIED'
                    }
                }
            }
            const fleetIds = recursive ? await this.geofenceSvcI.GetRecursiveFleets(accountId, fleetId, cookie, true) : [fleetId];
            return await this.geofenceSvcI.ListAsinablRuleUsers(accountId, userId, fleetIds, ruleId);
        } catch (error) {
            throw error;
        }
    }

    async AddRuleVehsLogic(accountId, userId, fleetId, ruleId, vinnos, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'ADD_RULE_VEHS_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.AddRuleVehs(accountId, userId, fleetId, ruleId, vinnos);
        } catch (error) {
            throw error;
        }
    }

    async DeleteRuleVehsLogic(accountId, userId, fleetId, ruleId, vinnos, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'DELETE_RULE_VEHS_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.DeleteRuleVehs(accountId, userId, fleetId, ruleId, vinnos);
        } catch (error) {
            throw error;
        }
    }

    async AddRuleFleetsLogic(accountId, userId, fleetId, ruleId, fleets, cookie, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'ADD_RULE_FLEETS_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.AddRuleFleets(accountId, userId, fleetId, ruleId, fleets, cookie);
        } catch (error) {
            throw error;
        }
    }

    async DeleteRuleFleetsLogic(accountId, userId, fleetId, ruleId, fleets, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'DELETE_RULE_FLEETS_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.DeleteRuleFleets(accountId, userId, fleetId, ruleId, fleets);
        } catch (error) {
            throw error;
        }
    }

    async AddRuleUsersLogic(accountId, userId, fleetId, ruleId, users, alertmeta, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin'], 'all');
                if (!hasPerms) {
                    throw {
                        errcode: 'ADD_RULE_USERS_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.AddRuleUsers(accountId, userId, fleetId, ruleId, users, alertmeta);
        } catch (error) {
            throw error;
        }
    }

    async UpdateUserNotiLogic(accountId, userIdAuth, fleetId, ruleId, userId, alertmeta, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.geofence.admin', 'geofence.rule.admin']);
                if (!hasPerms) {
                    throw {
                        errcode: 'UPDATE_USER_NOTI_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.UpdateUserNoti(accountId, userIdAuth, fleetId, ruleId, userId, alertmeta);
        } catch (error) {
            throw error;
        }
    }

    async DeleteRuleUsersLogic(accountId, userId, fleetId, ruleId, users, permissions) {
        try {
            const isValid = await this.UserFleetValidationLogic(accountId, userId, fleetId);
            if (!isValid) {
                throw {
                    errcode: 'INVALID_USER_ACCESS',
                };
            }
            if (!permissions.admin) {
                const permissionsList = permissions.map(perm => perm.permid);
                const hasPerms = CheckUserPerms(permissionsList, ['geofence.rule.admin', 'geofence.geofence.admin']);
                if (!hasPerms) {
                    throw {
                        errcode: 'DELETE_RULE_USERS_PERMISSION_DENIED'
                    }
                }
            }
            return await this.geofenceSvcI.DeleteRuleUsers(accountId, userId, fleetId, ruleId, users);
        } catch (error) {
            throw error;
        }
    }

    // helper
    async UserFleetValidationLogic(accountId, userId, fleetId) {
        try {
            const fleets = await this.geofenceSvcI.GetUserFleets(accountId, userId);
            if (!fleets) {
                return false;
            }
            return fleets.includes(fleetId);
        } catch (error) {
            throw error;
        }
    }

    //extras
    ruleTypes = {
        EntryExit: 'ENTRY_EXIT',
        Trip: 'TRIP',
    };

    actionTypes = {
        Entry: 'ENTRY',
        Exit: 'EXIT',
        EntryExit: 'ENTRY_EXIT',
        Trip: 'TRIP',
    };
}
