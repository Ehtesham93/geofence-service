import z from "zod";
import { APIResponseBadRequest, APIResponseForbidden, APIResponseInternalErr } from "./responseutil.js";
import { externalApiCall } from "./wrappers.js";
export function convertEpochToIST(epochMillis) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(new Date(epochMillis));
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return `${map.day} ${map.month} ${map.year} | ${map.hour}:${map.minute}:${map.second}`;
}

export function ErrCodeToObj(errcode) {
    switch (errcode) {
        case 'INVALID_USER_ACCESS':
            return {
                errcode: 'INVALID_USER_ACCESS',
                msg: 'User does not have access to do this action',
                func: APIResponseForbidden,
            };
        case 'INVALID_RULE_TYPE':
            return {
                errcode: 'INVALID_RULE_TYPE',
                msg: 'Rule type is not valid',
                func: APIResponseBadRequest,
            };
        case 'GEOFENCE_EXISTS':
            return {
                errcode: 'GEOFENCE_EXISTS',
                msg: 'Geofence already exists',
                func: APIResponseBadRequest,
            };
        case 'INVALID_RADIUS':
            return {
                errcode: 'INVALID_RADIUS',
                msg: 'Radius is not valid',
                func: APIResponseBadRequest,
            };
        case 'INVALID_CIRCLE':
            return {
                errcode: 'INVALID_CIRCLE',
                msg: 'Circle is not valid',
                func: APIResponseBadRequest,
            };
        case 'GEOFENCE_NAME_EXISTS':
            return {
                errcode: 'GEOFENCE_NAME_EXISTS',
                msg: 'Geofence name already exists',
                func: APIResponseBadRequest,
            };
        case 'GEOFENCE_NOT_FOUND':
            return {
                errcode: 'GEOFENCE_NOT_FOUND',
                msg: 'Geofence not found',
                func: APIResponseBadRequest,
            };
        case 'NO_GEOFENCES_FOUND':
            return {
                errcode: 'NO_GEOFENCES_FOUND',
                msg: 'No geofences found',
                func: APIResponseBadRequest,
            };
        case 'INVALID_POLYGON':
            return {
                errcode: 'INVALID_POLYGON',
                msg: 'Polygon is not valid',
                func: APIResponseBadRequest,
            };
        case 'GEOFENCE_IN_USE':
            return {
                errcode: 'GEOFENCE_IN_USE',
                msg: 'Geofence is in use',
                func: APIResponseBadRequest,
            };
        case 'GEOFENCE_ACTIVE':
            return {
                errcode: 'GEOFENCE_ACTIVE',
                msg: 'Geofence is active',
                func: APIResponseBadRequest,
            };
        case 'RULE_ACTIVE':
            return {
                errcode: 'RULE_ACTIVE',
                msg: 'Rule is active',
                func: APIResponseBadRequest,
            };
        case 'INVALID_GEOFENCE_AND_RULE':
            return {
                errcode: 'INVALID_GEOFENCE_AND_RULE',
                msg: 'Geofence and rule are not valid',
                func: APIResponseBadRequest,
            };
        case 'RULE_NAME_EXISTS':
            return {
                errcode: 'RULE_NAME_EXISTS',
                msg: 'Rule name already exists',
                func: APIResponseBadRequest,
            };
        case 'GEOFENCE_NOT_ACTIVE':
            return {
                errcode: 'GEOFENCE_NOT_ACTIVE',
                msg: 'Geofence is not active',
                func: APIResponseBadRequest,
            };
        case 'RULE_NOT_FOUND':
            return {
                errcode: 'RULE_NOT_FOUND',
                msg: 'Rule not found',
                func: APIResponseBadRequest,
            };
        case 'USER_NOT_FOUND_IN_RULE':
            return {
                errcode: 'USER_NOT_FOUND_IN_RULE',
                msg: 'User not found in any rule',
                func: APIResponseForbidden,
            };
        case 'INVALID_TIME_RANGE':
            return {
                errcode: 'INVALID_TIME_RANGE',
                msg: 'Invalid time range',
                func: APIResponseBadRequest,
            };
        case 'NO_VALID_TIME_BUCKETS':
            return {
                errcode: 'NO_VALID_TIME_BUCKETS',
                msg: 'Invalid time range',
                func: APIResponseBadRequest,
            };
        case 'INVALID_INPUT':
            return {
                errcode: 'INVALID_INPUT',
                msg: 'Invalid vehicles or rules provided',
                func: APIResponseBadRequest,
            };
        case 'PERMISSIONS_DENIED':
            return {
                errcode: 'PERMISSIONS_DENIED',
                msg: 'User does not have access to geofence module',
                func: APIResponseForbidden
            };
        case 'CREATE_GEOFENCE_PERMISSION_DENIED': 
            return {
                errcode: 'CREATE_GEOFENCE_PERMISSION_DENIED',
                msg: 'User does not have permission to create geofence',
                func: APIResponseForbidden
            };
        case 'GET_GEOFENCE_PERMISSION_DENIED':
            return {
                errcode: 'GET_GEOFENCE_PERMISSION_DENIED',
                msg: 'User does not have permission to get this geofence',
                func: APIResponseForbidden
        }
        case 'UPDATE_GEOFENCE_PERMISSION_DENIED': 
            return {
                errcode: 'UPDATE_GEOFENCE_PERMISSION_DENIED',
                msg: 'User does not have permission to update geofence',
                func: APIResponseForbidden
            }
        case 'DELETE_GEOFENCE_PERMISSION_DENIED': 
            return {
                errcode: 'DELETE_GEOFENCE_PERMISSION_DENIED',
                msg: 'User does not have permission to delete geofence',
                func: APIResponseForbidden
            }
        case 'LIST_GEO_RULES_PERMISSION_DENIED': 
            return {
                errcode: 'LIST_GEO_RULES_PERMISSION_DENIED',
                msg: 'User does not have permission to list geofence rules',
                func: APIResponseForbidden
            }
        case 'LIST_RULES_PERMISSION_DENIED':
            return {
                errcode: 'LIST_RULES_PERMISSION_DENIED',
                msg: 'User does not have permission to list rules',
                func: APIResponseForbidden
            }
        case 'CREATE_RULE_PERMISSION_DENIED':
            return {
                errcode: 'CREATE_RULE_PERMISSION_DENIED',
                msg: 'User does not have permission to create rule',
                func: APIResponseForbidden
            }
        case 'GET_RULE_PERMISSION_DENIED': 
            return {
                errcode: 'GET_RULE_PERMISSION_DENIED',
                msg: 'User does not have permission to fetch rule',
                func: APIResponseForbidden
            }
        case 'UPDATE_RULE_PERMISSION_DENIED':
            return {
                errcode: 'UPDATE_RULE_PERMISSION_DENIED',
                msg: 'User does not have permission to update rule',
                func: APIResponseForbidden
            }
        case 'UPDATE_RULE_STATE_PERMISSION_DENIED':
            return {
                errcode: 'UPDATE_RULE_STATE_PERMISSION_DENIED',
                msg: 'User does not have permission to update rule state',
                func: APIResponseForbidden
            }
        case 'DELETE_RULE_PERMISSION_DENIED':
            return {
                errcode: 'DELETE_RULE_PERMISSION_DENIED',
                msg: 'User does not have permission to delete rule',
                func: APIResponseForbidden
            }
        case 'LIST_ASSIGNABLE_RULE_PERMISSION_DENIED':
            return {
                errcode: 'LIST_ASSIGNABLE_RULE_PERMISSION_DENIED',
                msg: 'User does not have permission to list vehicles, assignable to rules',
                func: APIResponseForbidden
            }
        case 'LIST_ASIGN_RULE_FLEETS_PERM_DENIED':
            return {
                errcode: 'LIST_ASIGN_RULE_FLEETS_PERM_DENIED',
                msg: 'User does not have permission to list fleets, assignable to rules',
                func: APIResponseForbidden
            }
        case 'LIST_ASIGN_RULE_USERS_PERM_DENIED':
            return {
                errcode: 'LIST_ASIGN_RULE_USERS_PERM_DENIED',
                msg: 'User does not have permission to list users, assignable to rules',
                func: APIResponseForbidden
            }
        case 'ADD_RULE_VEHS_PERMISSION_DENIED':
            return {
                errcode: 'ADD_RULE_VEHS_PERMISSION_DENIED',
                msg: 'User does not have permission to add vehicles to rule',
                func: APIResponseForbidden
            }
        case 'DELETE_RULE_VEHS_PERMISSION_DENIED':
            return {
                errcode: 'DELETE_RULE_VEHS_PERMISSION_DENIED',
                msg: 'User does not have permission to delete vehicle from rule',
                func: APIResponseForbidden
            }
        case 'ADD_RULE_FLEETS_PERMISSION_DENIED':
            return {
                errcode: 'ADD_RULE_FLEETS_PERMISSION_DENIED',
                msg: 'User does not have permission to add fleets to rule',
                func: APIResponseForbidden
            }
        case 'DELETE_RULE_FLEETS_PERMISSION_DENIED':
            return {
                errcode: 'DELETE_RULE_FLEETS_PERMISSION_DENIED',
                msg: 'User does not have permission to delete fleets from rule',
                func: APIResponseForbidden
            }
        case 'ADD_RULE_USERS_PERMISSION_DENIED':
            return {
                errcode: 'ADD_RULE_USERS_PERMISSION_DENIED',
                msg: 'User does not have permission to add users to rule',
                func: APIResponseForbidden
            }
        case 'UPDATE_USER_NOTI_PERMISSION_DENIED':
            return {
                errcode: 'UPDATE_USER_NOTI_PERMISSION_DENIED',
                msg: 'User does not have permission to update user notification',
                func: APIResponseForbidden
            }
        case 'DELETE_RULE_USERS_PERMISSION_DENIED':
            return {
                errcode: 'DELETE_RULE_USERS_PERMISSION_DENIED',
                msg: 'User does not have permission to delete users from rule',
                func: APIResponseForbidden
            }
        case 'ALERT_REPORT_PERM_DENIED':
            return {
                errcode: 'ALERT_REPORT_PERM_DENIED',
                msg: 'User does not have permission to view alert report',
                func: APIResponseForbidden
            }
        case 'TRIP_REPORT_PERM_DENIED':
            return {
                errcode: 'TRIP_REPORT_PERM_DENIED',
                msg: 'User does not have permission to view trip report',
                func: APIResponseForbidden
            }
        default:
            console.log('Error code not found', errcode);
            return {
                errcode: 'INTERNAL_SERVER_ERROR',
                msg: 'Something went wrong',
                func: APIResponseInternalErr,
            };
    }
}

export async function GetMyGeofencePermissions(req, res, next) { //EXPRESS Middleware
    try {
        const fleetid = req?.body?.fleetid || req?.params?.fleetid || req?.query?.fleetid; //Fleet id can be body , param and query
        const reqPath = req.path; //it does means current endpoint path 
        if (reqPath.includes('/listruletypes') || reqPath.includes('/listactiontypes')) { // listrules type and listactiontypes these two no need to permission checking 
            next();  //thats why it calls the next 
            return;
        }

        //fleet validation by zod schema 
        const schema = z.object({ // validate the fleetid --> if missing or it not is uuid formate then invalid fleetid 
            fleetid: z.uuid({ message: "Invalid fleetid, must be a valid uuid"})
        });
        schema.parse({ fleetid }); // it does the fleeId validation
        const cookie = req.headers['Cookie'] || req.headers['cookie'];  // request cookies from header and checking the upper case and lowercase 

        //the external api take base url. fro congig 
        const path = `/api/v1/fms/account/fleet/${fleetid}/getmyperms`; // external API call to fms microservices call
        const permissions = await externalApiCall(path, {}, 'GET', cookie); // call external api to take user permission 

        //checking permission list of geofence eg :- geofence create and geofence view 
        const permissionsList = permissions.data.permissions; 
        const permissionsByModule = permissions.data.permissionsbymodule;
        const isAdmin = permissionsList.includes('all.all.all');  //here checking user permission like all.all.all then admin
        const geofencePermissions = permissionsByModule.find(module => module.modulename === 'Geofence'); // finding geofence module permissiion

        // if not geofencePermission then APIResponseForbidden 
        if (!geofencePermissions) {
            return APIResponseForbidden(req, res, "PERMISSIONS_DENIED", null, "User does not have access to geofence module");
        }
        req.permissions = { ...geofencePermissions, admin: isAdmin };
        next();
    } catch (error) {
        //fleetId invalid then errro bsdRequest => 400
        if (error instanceof z.ZodError) {
            return APIResponseBadRequest(req, res, "INPUT_ERROR", null, error.issues[0].message);
        }
        return APIResponseForbidden(req, res, "PERMISSIONS_DENIED", null, error.toString());
    }
}


export function CheckUserPerms(userPermissions, requiredPermissions, mode = "any") {
    if (!userPermissions || !Array.isArray(userPermissions)) {
      return false;
    }
  
    if (userPermissions.includes("all.all.all")) {
      return true;
    }
  
    if (!requiredPermissions || !Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
      return false;
    }
  
    if (mode === "all") {
      return requiredPermissions.every((perm) => userPermissions.includes(perm));
    } else {
      return requiredPermissions.some((perm) => userPermissions.includes(perm));
    }
}
  