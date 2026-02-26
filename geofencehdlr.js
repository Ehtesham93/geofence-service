// Geofence HTTP handler: validates inputs (zod), enforces auth via middlewares,
// delegates to implementation logic, and normalizes API responses.
import { z } from 'zod';
import { APIResponseInternalErr, APIResponseOK, APIResponseBadRequest } from '../../utils/responseutil.js';
import GeofenceHdlrImpl from './geofencehdlr_impl.js';
import { AuthenticateAccountTokenFromCookie } from '../../utils/tokenutil.js';
import { ErrCodeToObj, GetMyGeofencePermissions } from '../../utils/utils.js';

export default class GeofenceHdlr {
         constructor(geofenceSvcI, logger) {
        this.geofenceHdlrImpl = new GeofenceHdlrImpl(geofenceSvcI, logger);
        this.logger = logger;
    }

    RegisterRoutes(router) { 
        // Public helper to seed token for Swagger/clients; rest require auth + permissions

        router.post('/settoken', this.setToken); // set token in cookies
        router.use(AuthenticateAccountTokenFromCookie); 
        router.use(GetMyGeofencePermissions); 

        // Geofence CRUD    
        router.post('/create', this.CreateGeofence);
        router.post('/create/withrule', this.CreateGeofenceWithRule);
        router.get('/list/withrule', this.GetGeofencesWithActionInfo);
        router.get('/list', this.GetGeofence);
        router.get('/list/:geofenceid', this.GetGeofenceById);
        router.put('/update', this.UpdateGeofence);
        router.put('/updateactive/withrule', this.UpdateGeofenceStateWithRule);
        router.put('/updateactive', this.UpdateGeofenceState);
        router.delete('/delete/withrule', this.DeleteGeofenceWithRule);
        router.delete('/delete', this.DeleteGeofence);
        router.get('/listgeorules', this.ListGeoRules);   

        // Rule taxonomy and assignment
        //handle crude rules
        router.get('/listruletypes', this.ListRuleTypes);
        router.get('/listactiontypes', this.ListActionTypes);
        router.post('/createrule', this.CreateRule);
        router.get('/listrules', this.ListRules);
        router.get('/rule/:ruleid', this.GetRuleById);
        router.put('/updaterule', this.UpdateRule);
        router.put('/updateruleactive', this.UpdateRuleState);
        router.delete('/deleterule', this.DeleteRule);
        
        // Assignment management
        //it means it assign and unassign rule from vehicle/fleet/users
        router.get('/listasinablrulevehs', this.ListAsinablRuleVehs);
        router.get('/listasinablrulefleets', this.ListAsinablRuleFleets);
        router.get('/listasinablruleusers', this.ListAsinablRuleUsers);
        router.post('/addrulevehs', this.AddRuleVehs);
        router.post('/rmrulevehs', this.DeleteRuleVehs);
        router.post('/addrulefleets', this.AddRuleFleets);
        router.post('/rmrulefleets', this.DeleteRuleFleets);
        router.post('/addruleusers', this.AddRuleUsers);
        router.put('/updateusernoti', this.UpdateUserNoti);
        router.post('/rmruleusers', this.DeleteRuleUsers);
    }

    setToken = async (req, res, next) => {
        try {
            const token = req.body.token; //set Token in cookies from take req body

            //validate the schema if token is missing/empty -> throw internal_Error
            const schema = z.object({
                token: z.string({ message: 'token is required' }).nonempty({ message: 'token cannot be empty' }),
            });
            schema.parse({ token }); // token missing/empty -> send internal error

            const cookieOptions = {
                httpOnly: false,
                secure: false,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            };

            //store cookies in browser and send success response 
            //sent api response bad response , internal error and success response 
            res.cookie('token', token, cookieOptions); 
            APIResponseOK(
                req,
                res,
                {
                    message: 'token set successfully in cookie',
                    cookieSet: true,
                    swaggerReady: true,
                },
                'token set in cookie successful'
            );
        } catch (error) {
            if (error.errcode === 'INPUT_ERROR') {
                APIResponseBadRequest(req, res, error.errcode, error.errdata, error.message);
            } else {
                APIResponseInternalErr(req, res, 'SET_TOKEN_ERR', error.toString(), 'Set token failed');
            }
        }
    };

    //body request formate should match to create geofence
    CreateGeofence = async (req, res, next) => {
        try {
            // validate request body
            const createGeofenceSchema = z.object({
                fleetid: z.uuid(),
                geofencename: z
                    .string()
                    .min(1)
                    .max(255)
                    .regex(/^[A-Za-z0-9 _-]+$/),
                geofenceinfo: z.object({
                    type: z.enum(['circle', 'polygon']),
                    latlngs: z.array(z.object({ lat: z.number(), lng: z.number() })).min(1),
                    radius: z.number(),
                }),
                meta: z.object({
                    address: z.string().max(255),
                    tag: z.array(z.string().min(1).max(255)).min(1),
                    center: z.object({ lat: z.number(), lng: z.number() }),
                    colour: z.string().min(1).max(255),
                    area: z
                        .string()
                        .min(1)
                        .max(255)
                        .regex(/^\d+(\.\d+)?\s+sq\s+km$/),
                }),
            });

            //to authentication and check permission 
            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            console.log({
                'accountid': accountid,
                'userid': userid,
                'permissions': permissions
            }, "=========>>>>>>>>>>>>>>>>")

            //if not permission and not admin -> error permission denied
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }

            //validate the all input by zod and catch the clean error
            const { fleetid, geofencename, geofenceinfo, meta } = this.validateAllInputs(createGeofenceSchema, req.body);

            //inserting the DB and send to client to json response and also catch centralize error like 200, 400, 600 something
            const result = await this.geofenceHdlrImpl.CreateGeofenceLogic(accountid, userid, fleetid, geofencename, geofenceinfo, meta, permissions);
            APIResponseOK(req, res, result, 'Geofence created successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    CreateGeofenceWithRule = async (req, res, next) => {
        try {
            const createGeofenceSchema = z.object({
                fleetid: z.uuid(),
                geofencename: z
                    .string()
                    .min(1)
                    .max(255)
                    .regex(/^[A-Za-z0-9 _-]+$/),
                geofenceinfo: z.object({
                    latlngs: z.array(z.object({ lat: z.number(), lng: z.number() })).min(1),
                    radius: z.number(),
                }),
                meta: z.object({
                    address: z.string().max(255).optional(),
                    tag: z.array(z.string().min(1).max(255)).min(1),
                    colour: z.string().min(1).max(255),
                    area: z
                        .string()
                        .min(1)
                        .max(255)
                        .regex(/^\d+(\.\d+)?\s+sq\s+km$/),
                }),
                rule: z.object({
                    meta: z.record(z.string().min(1).max(255), z.any()),
                    actiontypeid: z.enum([this.actionTypes.Entry, this.actionTypes.Exit, this.actionTypes.EntryExit]),
                }),
                vehicles: z.array(z.string().min(1).max(255)).min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofencename, geofenceinfo, meta, rule, vehicles } = this.validateAllInputs(createGeofenceSchema, req.body);
            const result = await this.geofenceHdlrImpl.CreateGeofenceWithRuleLogic(accountid, userid, fleetid, geofencename, geofenceinfo, meta, rule, vehicles, permissions);
            APIResponseOK(req, res, result, 'Geofence created successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    // input taking and validate zod schema
    GetGeofence = async (req, res, next) => {
        try {
            const getGeofenceSchema = z.object({
                fleetid: z.uuid(),
                recursive: z.enum(['true', 'false'])
            });

            //take data from middleware and set in cookies 
            const accountid = req.accountid;
            const userid = req.userid;
            const cookie = req.cookie;
            const permissions = req.permissions.perms;

            //if user's has not geofence permission and also user is not admin the stop 
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, recursive } = this.validateAllInputs(getGeofenceSchema, req.query);

            // it calls the business logic 
            const result = await this.geofenceHdlrImpl.GetGeofenceLogic( 
            accountid, userid, fleetid, recursive === 'true', cookie, permissions
        );

            //success response 
            APIResponseOK(req, res, result, 'Geofence fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);        
        }
    };

    GetGeofenceById = async (req, res, next) => {
        try {
            const getGeofenceByIdSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid } = this.validateAllInputs(getGeofenceByIdSchema, {
                fleetid: req.query.fleetid,
                geofenceid: req.params.geofenceid,
            });
            const result = await this.geofenceHdlrImpl.GetGeofenceByIdLogic(accountid, userid, fleetid, geofenceid, permissions);
            APIResponseOK(req, res, result, 'Geofence fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetGeofencesWithActionInfo = async (req, res, next) => {
        try {
            const getGeofencesWithActionInfoSchema = z.object({
                fleetid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid } = this.validateAllInputs(getGeofencesWithActionInfoSchema, req.query);
            const result = await this.geofenceHdlrImpl.GetGeofencesWithActionInfoLogic(accountid, userid, fleetid, permissions);
            APIResponseOK(req, res, result, 'Geofences with action info fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    UpdateGeofence = async (req, res, next) => {
        try {
            const updateGeofenceSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
                geofencename: z
                    .string()
                    .min(1)
                    .max(255)
                    .regex(/^[A-Za-z0-9 _-]+$/)
                    .optional(),
                geofenceinfo: z
                    .object({
                        type: z.enum(['circle', 'polygon']),
                        latlngs: z.array(z.object({ lat: z.number(), lng: z.number() })).min(1),
                        radius: z.number(),
                    })
                    .optional(),
                meta: z
                    .object({
                        address: z.string().min(1).max(255),
                        tag: z.array(z.string().min(1).max(255)).min(1),
                        center: z.object({ lat: z.number(), lng: z.number() }),
                        colour: z.string().min(1).max(255),
                        area: z
                            .string()
                            .min(1)
                            .max(255)
                            .regex(/^\d+(\.\d+)?\s+sq\s+km$/),
                    })
                    .optional(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid, geofencename = null, geofenceinfo = null, meta = null } = this.validateAllInputs(updateGeofenceSchema, req.body);
            const result = await this.geofenceHdlrImpl.UpdateGeofenceLogic(accountid, userid, fleetid, geofenceid, geofencename, geofenceinfo, meta, permissions);
            APIResponseOK(req, res, result, 'Geofence updated successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    UpdateGeofenceStateWithRule = async (req, res, next) => {
        try {
            const updateGeofenceStateMobileSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
                ruleid: z.uuid(),
                isactive: z.boolean(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid, ruleid, isactive } = this.validateAllInputs(updateGeofenceStateMobileSchema, req.body);
            const result = await this.geofenceHdlrImpl.UpdateGeofenceStateWithRuleLogic(accountid, userid, fleetid, geofenceid, ruleid, isactive, permissions);
            const message = result.message;
            delete result.message;
            APIResponseOK(req, res, result, message);
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    UpdateGeofenceState = async (req, res, next) => {
        try {
            const updateActiveGeofenceSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
                isactive: z.boolean(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid, isactive } = this.validateAllInputs(updateActiveGeofenceSchema, req.body);
            const result = await this.geofenceHdlrImpl.UpdateGeofenceStateLogic(accountid, userid, fleetid, geofenceid, isactive, permissions);
            const message = result.message;
            delete result.message;
            APIResponseOK(req, res, result, message);
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    DeleteGeofenceWithRule = async (req, res, next) => {
        try {
            const deleteGeofenceWithRuleSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
                ruleid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid, ruleid } = this.validateAllInputs(deleteGeofenceWithRuleSchema, req.query);
            await this.geofenceHdlrImpl.DeleteGeofenceWithRuleLogic(accountid, userid, fleetid, geofenceid, ruleid, permissions);
            APIResponseOK(req, res, null, 'Geofence deleted successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    DeleteGeofence = async (req, res, next) => {
        try {
            const deleteGeofenceSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid } = this.validateAllInputs(deleteGeofenceSchema, req.query);
            const result = await this.geofenceHdlrImpl.DeleteGeofenceLogic(accountid, userid, fleetid, geofenceid, permissions);
            APIResponseOK(req, res, result, 'Geofence deleted successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListGeoRules = async (req, res, next) => {
        try {
            const listGeoRulesSchema = z.object({
                fleetid: z.uuid(),
                geofenceid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, geofenceid } = this.validateAllInputs(listGeoRulesSchema, req.query);
            const result = await this.geofenceHdlrImpl.ListGeoRulesLogic(accountid, userid, fleetid, geofenceid, permissions);
            APIResponseOK(req, res, result, 'Geofence rules fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListRuleTypes = async (req, res, next) => {
        try {
            const result = await this.geofenceHdlrImpl.ListRuleTypesLogic();
            APIResponseOK(req, res, result, 'Rule types fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListActionTypes = async (req, res, next) => {
        try {
            const result = await this.geofenceHdlrImpl.ListActionTypesLogic();
            APIResponseOK(req, res, result, 'Action types fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    CreateRule = async (req, res, next) => {
        try {
            const createRuleSchema = z.object({
                fleetid: z.uuid(),
                rule: z.object({
                    rulename: z
                        .string()
                        .min(1)
                        .max(255)
                        .regex(/^[A-Za-z0-9 _-]+$/),
                    ruletypeid: z.enum([this.ruleTypes.EntryExit, this.ruleTypes.Trip]),
                    meta: z.record(z.string().min(1).max(255), z.any()),
                    rulegeoinfo: z
                        .array(
                            z.object({
                                geofenceid: z.uuid(),
                                seqno: z.enum(['0', '1']),
                                actiontypeid: z.enum([this.actionTypes.Entry, this.actionTypes.Exit, this.actionTypes.EntryExit]),
                                meta: z.object({
                                    duration: z.number(),
                                    time: z.number(),
                                    repeats: z.number(),
                                }),
                            })
                        )
                        .min(1),
                }),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, rule } = this.validateAllInputs(createRuleSchema, req.body);
            const result = await this.geofenceHdlrImpl.CreateRuleLogic(accountid, userid, fleetid, rule, permissions);
            APIResponseOK(req, res, result, 'Rule created successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListRules = async (req, res, next) => {
        try {
            const listRulesSchema = z.object({
                fleetid: z.uuid(),
                recursive: z.enum(['true', 'false']),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, recursive } = this.validateAllInputs(listRulesSchema, req.query);
            const cookie = req.cookie;
            const result = await this.geofenceHdlrImpl.ListRulesLogic(accountid, userid, fleetid, recursive === 'true', cookie, permissions);
            APIResponseOK(req, res, result, 'Rules fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    GetRuleById = async (req, res, next) => {
        try {
            const getRuleByIdSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid } = this.validateAllInputs(getRuleByIdSchema, {
                fleetid: req.query.fleetid,
                ruleid: req.params.ruleid,
            });
            const result = await this.geofenceHdlrImpl.GetRuleByIdLogic(accountid, userid, fleetid, ruleid, permissions);
            APIResponseOK(req, res, result, 'Rule fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    UpdateRule = async (req, res, next) => {
        try {
            const updateRuleSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                rulename: z
                    .string()
                    .min(1)
                    .max(255)
                    .regex(/^[A-Za-z0-9 _-]+$/)
                    .optional(),
                ruletypeid: z.enum([this.ruleTypes.EntryExit, this.ruleTypes.Trip]).optional(),
                meta: z.record(z.string().min(1).max(255), z.any()).optional(),
                rulegeoinfo: z
                    .array(
                        z.object({
                            geofenceid: z.uuid(),
                            seqno: z.enum(['0', '1']),
                            actiontypeid: z.enum([this.actionTypes.Entry, this.actionTypes.Exit, this.actionTypes.EntryExit]),
                            meta: z.object({
                                duration: z.number(),
                                time: z.number(),
                                repeats: z.number(),
                            }),
                        })
                    )
                    .min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, rulename = null, ruletypeid = null, meta = null, rulegeoinfo = null } = this.validateAllInputs(updateRuleSchema, req.body);
            const result = await this.geofenceHdlrImpl.UpdateRuleLogic(accountid, userid, fleetid, ruleid, rulename, ruletypeid, meta, rulegeoinfo, permissions);
            APIResponseOK(req, res, result, 'Rule updated successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    UpdateRuleState = async (req, res, next) => {
        try {
            const updateActiveRuleSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                isactive: z.boolean(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, isactive } = this.validateAllInputs(updateActiveRuleSchema, req.body);
            const result = await this.geofenceHdlrImpl.UpdateRuleStateLogic(accountid, userid, fleetid, ruleid, isactive, permissions);
            APIResponseOK(req, res, result, 'Rule state updated successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    DeleteRule = async (req, res, next) => {
        try {
            const deleteRuleSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid } = this.validateAllInputs(deleteRuleSchema, req.query);
            const result = await this.geofenceHdlrImpl.DeleteRuleLogic(accountid, userid, fleetid, ruleid, permissions);
            APIResponseOK(req, res, result, 'Rule deleted successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListAsinablRuleVehs = async (req, res, next) => {
        try {
            const listAsinablRuleVehsSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                recursive: z.enum(['true', 'false']),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, recursive } = this.validateAllInputs(listAsinablRuleVehsSchema, req.query);
            const cookie = req.cookie;
            const result = await this.geofenceHdlrImpl.ListAsinablRuleVehsLogic(accountid, userid, fleetid, ruleid, recursive === 'true', cookie, permissions);
            APIResponseOK(req, res, result, 'Assignable rule vehicles fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListAsinablRuleFleets = async (req, res, next) => {
        try {
            const listAsinablRuleFleetsSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                recursive: z.enum(['true', 'false']),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, recursive } = this.validateAllInputs(listAsinablRuleFleetsSchema, req.query);
            const cookie = req.cookie;
            const result = await this.geofenceHdlrImpl.ListAsinablRuleFleetsLogic(accountid, userid, fleetid, ruleid, true, cookie, permissions);
            APIResponseOK(req, res, result, 'Assignable rule fleets fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    ListAsinablRuleUsers = async (req, res, next) => {
        try {
            const listAsinablRuleUsersSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                recursive: z.enum(['true', 'false']),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, recursive } = this.validateAllInputs(listAsinablRuleUsersSchema, req.query);
            const cookie = req.cookie;
            const result = await this.geofenceHdlrImpl.ListAsinablRuleUsersLogic(accountid, userid, fleetid, ruleid, recursive === 'true', cookie, permissions);
            APIResponseOK(req, res, result, 'Assignable rule users fetched successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    AddRuleVehs = async (req, res, next) => {
        try {
            const addRuleVehsSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                vinnos: z.array(z.string().length(17)).min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, vinnos } = this.validateAllInputs(addRuleVehsSchema, req.body);
            const result = await this.geofenceHdlrImpl.AddRuleVehsLogic(accountid, userid, fleetid, ruleid, vinnos, permissions);
            APIResponseOK(req, res, result, 'Vehicles added to rule successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    DeleteRuleVehs = async (req, res, next) => {
        try {
            const deleteRuleVehsSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                vinnos: z.array(z.string().length(17)).min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, vinnos } = this.validateAllInputs(deleteRuleVehsSchema, req.body);
            const result = await this.geofenceHdlrImpl.DeleteRuleVehsLogic(accountid, userid, fleetid, ruleid, vinnos, permissions);
            APIResponseOK(req, res, result, 'Vehicles deleted from rule successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    AddRuleFleets = async (req, res, next) => {
        try {
            const addRuleFleetsSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                fleets: z.array(z.uuid()).min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, fleets } = this.validateAllInputs(addRuleFleetsSchema, req.body);
            const cookie = req.cookie;
            const result = await this.geofenceHdlrImpl.AddRuleFleetsLogic(accountid, userid, fleetid, ruleid, fleets, cookie, permissions);
            APIResponseOK(req, res, result, 'Fleets added to rule successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    DeleteRuleFleets = async (req, res, next) => {
        try {
            const deleteRuleFleetsSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                fleets: z.array(z.uuid()).min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, fleets } = this.validateAllInputs(deleteRuleFleetsSchema, req.body);
            const result = await this.geofenceHdlrImpl.DeleteRuleFleetsLogic(accountid, userid, fleetid, ruleid, fleets, permissions);
            APIResponseOK(req, res, result, 'Fleets deleted from rule successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    AddRuleUsers = async (req, res, next) => {
        try {
            const addRuleUsersSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                users: z.array(z.uuid()).min(1),
                alertmeta: z.object({
                    emailnoti: z.boolean(),
                    pushnoti: z.boolean(),
                }),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, users, alertmeta } = this.validateAllInputs(addRuleUsersSchema, req.body);
            const result = await this.geofenceHdlrImpl.AddRuleUsersLogic(accountid, userid, fleetid, ruleid, users, alertmeta, permissions);
            APIResponseOK(req, res, result, 'Users added to rule successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    UpdateUserNoti = async (req, res, next) => {
        try {
            const updateUserNotiSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                userid: z.uuid(),
                alertmeta: z.object({
                    emailnoti: z.boolean(),
                    pushnoti: z.boolean(),
                }),
            });

            const accountid = req.accountid;
            const useridAuth = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, userid, alertmeta } = this.validateAllInputs(updateUserNotiSchema, req.body);
            const result = await this.geofenceHdlrImpl.UpdateUserNotiLogic(accountid, useridAuth, fleetid, ruleid, userid, alertmeta, permissions);
            APIResponseOK(req, res, result, 'User notification updated successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    DeleteRuleUsers = async (req, res, next) => {
        try {
            const deleteRuleUsersSchema = z.object({
                fleetid: z.uuid(),
                ruleid: z.uuid(),
                users: z.array(z.uuid()).min(1),
            });

            const accountid = req.accountid;
            const userid = req.userid;
            const permissions = req.permissions.perms;
            if (permissions.length === 0 && !req.permissions.admin) {
                throw {
                    errcode: 'PERMISSIONS_DENIED'
                }
            }
            const { fleetid, ruleid, users } = this.validateAllInputs(deleteRuleUsersSchema, req.body);
            const result = await this.geofenceHdlrImpl.DeleteRuleUsersLogic(accountid, userid, fleetid, ruleid, users, permissions);
            APIResponseOK(req, res, result, 'Users deleted from rule successfully');
        } catch (error) {
            this.handleError(req, res, error);
        }
    };

    // Utility: parse with zod schema and produce compact, user-friendly errors
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

    // Centralized error mapping to API responses
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
