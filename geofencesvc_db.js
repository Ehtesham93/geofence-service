//geofencesvc_db.js
import GeofenceSvcUtils from './geofencesvcutils.js';
import { convertEpochToIST } from '../../utils/utils.js';
import { computeExpireyAt } from './geofencesvc_expiry_utils.js';

export default class GeofenceSvcDB {
    constructor(pgPoolI, logger, config) {
        this.pgPoolI = pgPoolI;
        this.logger = logger;
        this.config = config;
        this.geofenceSvcUtils = new GeofenceSvcUtils(logger, config);
    }

    async createGeofence(accountId, userId, fleetId, geofenceName, geofenceInfo, meta) {
        try {
            const currentTime = new Date();

            const geoExist = await this.isGeofenceNameExists(accountId, fleetId, geofenceName);
            if (geoExist) {
                throw {
                    errcode: 'GEOFENCE_EXISTS',
                };
            }

            if (geofenceInfo.type === 'circle') {
                if (geofenceInfo.radius <= 0) {
                    throw {
                        errcode: 'INVALID_RADIUS',
                    };
                }
                if (geofenceInfo.latlngs.length !== 1) {
                    throw {
                        errcode: 'INVALID_CIRCLE',
                    };
                }
            }

            if (geofenceInfo.type === 'polygon') {
                const polygon = geofenceInfo.latlngs;
                if (polygon.length < 3) {
                    throw {
                        errcode: 'INVALID_POLYGON',
                    };
                }
            }

            const geofenceId = this.geofenceSvcUtils.getUUID();
            const query = `
                    INSERT INTO geofence (geofenceid, accountid, fleetid, geofencename, isactive, geofenceinfo, meta, createdat, createdby, updatedat, updatedby)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING *`;
            const result = await this.pgPoolI.Query(query, [geofenceId, accountId, fleetId, geofenceName, true, geofenceInfo, meta, currentTime, userId, currentTime, userId]);
            const rows = result.rows[0];
            const response = {
                fleetid: rows.fleetid,
                geofenceid: rows.geofenceid,
                geofencename: rows.geofencename,
                geofenceinfo: {
                    type: rows.geofenceinfo.type,
                    latlngs: rows.geofenceinfo.latlngs,
                    radius: rows.geofenceinfo.radius,
                },
                meta: {
                    address: rows.meta.address,
                    tag: rows.meta.tag,
                    center: {
                        lat: rows.meta.center.lat,
                        lng: rows.meta.center.lng,
                    },
                    colour: rows.meta.colour,
                    area: rows.meta.area,
                },
            };

            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async createGeofenceWithRule(accountId, userId, fleetId, geofenceName, geofenceInfo, meta, rule, vehicles) {
        const expiryAt = computeExpireyAt(rule.expiryDuration);
        try {
            const createGeofenceResult = await this.createGeofence(
                accountId,
                userId,
                fleetId,
                geofenceName,
                {
                    type: 'circle',
                    latlngs: geofenceInfo.latlngs,
                    radius: geofenceInfo.radius,
                },
                {
                    address: meta.address,
                    tag: meta.tag,
                    center: {
                        lat: geofenceInfo.latlngs[0].lat,
                        lng: geofenceInfo.latlngs[0].lng,
                    },
                    colour: meta.colour,
                    area: meta.area,
                }
            );
            const geofenceId = createGeofenceResult?.geofenceid;
            let createRuleResult;
            try {
                createRuleResult = await this.createRule(accountId, userId, fleetId, {
                    rulename: `${geofenceName} Rule`,
                    ruletypeid: this.ruleTypes.EntryExit,
                    meta: rule.meta,
                    expiryAt,
                    rulegeoinfo: [
                        {
                            geofenceid: geofenceId,
                            seqno: 0,
                            actiontypeid: rule.actiontypeid,
                            meta: {},
                        },
                    ],
                });
            } catch (error) {
                await this.updateGeofenceState(accountId, userId, fleetId, geofenceId, false);
                await this.deleteGeofence(accountId, userId, fleetId, geofenceId);
                throw {
                    errcode: error?.errcode || 'INTERNAL_ERROR',
                };
            }
            const ruleId = createRuleResult?.ruleid;
            try {
                await this.addRuleVehs(accountId, userId, fleetId, ruleId, vehicles);
            } catch (error) {
                await this.updateRuleState(accountId, userId, fleetId, ruleId, false);
                await this.deleteRule(accountId, userId, fleetId, ruleId);
                await this.updateGeofenceState(accountId, userId, fleetId, geofenceId, false);
                await this.deleteGeofence(accountId, userId, fleetId, geofenceId);
                throw {
                    errcode: error?.errcode || 'INTERNAL_ERROR',
                };
            }
            return await this.getGeofenceAndRuleWithVehicles(accountId, fleetId, geofenceId, ruleId);
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeofence(accountId, fleetIds) {
        try {
            const query = `SELECT fleetid, geofenceid, geofencename, isactive, geofenceinfo, meta FROM geofence 
                            WHERE fleetid = ANY($1::uuid[])
                                AND accountid = $2 
                                AND isdeleted = false
                                 AND (r.expiry_at IS NULL OR r.expiry_at > now())
                            ORDER BY createdat DESC`;
            const result = await this.pgPoolI.Query(query, [fleetIds, accountId]);
            const rows = result.rows;

            const geofenceIds = rows.map((row) => row.geofenceid);
            let rulesData = [];

            if (geofenceIds.length > 0) {
                const rulesQuery = `SELECT DISTINCT ON (gri.geofenceid, gr.ruleid) gri.geofenceid, gr.ruleid, gr.rulename, 
                                    gr.ruletypeid, gr.isactive, gri.seqno, gri.actiontypeid
                                    FROM geofenceruleinfo gri
                                    INNER JOIN geofencerule gr ON gri.ruleid = gr.ruleid 
                                        AND gri.accountid = gr.accountid 
                                        AND gri.fleetid = gr.fleetid
                                    WHERE gri.accountid = $1 
                                        AND gri.fleetid = ANY($2::uuid[])
                                        AND gri.geofenceid = ANY($3::uuid[])
                                        AND gr.isdeleted = false
                                    ORDER BY gri.geofenceid, gr.ruleid, gri.seqno, gri.actiontypeid`;

                const rulesResult = await this.pgPoolI.Query(rulesQuery, [accountId, fleetIds, geofenceIds]);
                rulesData = rulesResult.rows;
            }

            const rulesByGeofence = {};
            rulesData.forEach((rule) => {
                if (!rulesByGeofence[rule?.geofenceid]) {
                    rulesByGeofence[rule?.geofenceid] = [];
                }
                rulesByGeofence[rule?.geofenceid].push({
                    ruleid: rule?.ruleid,
                    rulename: rule?.rulename,
                    ruletypeid: rule?.ruletypeid,
                    isactive: rule?.isactive,
                    seqno: rule?.seqno,
                    actiontypeid: rule?.actiontypeid,
                });
            });

            const response = rows.map((row) => ({
                fleetid: row?.fleetid,
                geofenceid: row?.geofenceid,
                geofencename: row?.geofencename,
                isactive: row?.isactive,
                geofenceinfo: {
                    type: row?.geofenceinfo?.type,
                    latlngs: row?.geofenceinfo?.latlngs,
                    radius: row?.geofenceinfo?.radius,
                },
                meta: {
                    address: row?.meta?.address,
                    tag: row?.meta?.tag,
                    center: {
                        lat: row?.meta?.center?.lat,
                        lng: row?.meta?.center?.lng,
                    },
                    colour: row?.meta?.colour,
                    area: row?.meta?.area,
                },
                rules: rulesByGeofence[row?.geofenceid] || [],
            }));
            return response;
        } catch (error) {
            this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeofenceById(accountId, userId, fleetId, geofenceId) {
        try {
            const isExists = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!isExists) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }
            const query = `SELECT fleetid, geofenceid, geofencename, isactive, geofenceinfo, meta 
                            FROM geofence 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND geofenceid = $3
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceId]);
            const rows = result.rows[0];

            const rulesQuery = `SELECT gri.geofenceid, gr.ruleid, gr.rulename, gr.ruletypeid, gr.isactive, gri.seqno, gri.actiontypeid
                                    FROM geofenceruleinfo gri
                                    INNER JOIN geofencerule gr ON gri.ruleid = gr.ruleid 
                                        AND gri.accountid = gr.accountid 
                                        AND gri.fleetid = gr.fleetid
                                    WHERE gri.accountid = $1 
                                        AND gri.fleetid = $2 
                                        AND gri.geofenceid = $3
                                        AND gr.isdeleted = false
                                    ORDER BY gri.geofenceid, gri.seqno`;

            const rulesResult = await this.pgPoolI.Query(rulesQuery, [accountId, fleetId, geofenceId]);
            const rulesData = rulesResult.rows;

            const response = {
                fleetid: rows?.fleetid,
                geofenceid: rows?.geofenceid,
                geofencename: rows?.geofencename,
                isactive: rows?.isactive,
                geofenceinfo: {
                    type: rows?.geofenceinfo?.type,
                    latlngs: rows?.geofenceinfo?.latlngs,
                    radius: rows?.geofenceinfo?.radius,
                },
                meta: {
                    address: rows?.meta?.address,
                    tag: rows?.meta?.tag,
                    center: {
                        lat: rows?.meta?.center?.lat,
                        lng: rows?.meta?.center?.lng,
                    },
                    colour: rows?.meta?.colour,
                    area: rows?.meta?.area,
                },
                rules: rulesData.map((rule) => ({
                    ruleid: rule?.ruleid,
                    rulename: rule?.rulename,
                    ruletypeid: rule?.ruletypeid,
                    isactive: rule?.isactive,
                    seqno: rule?.seqno,
                    actiontypeid: rule?.actiontypeid,
                })),
            };
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeofencesWithActionInfo(accountId, userId, fleetId) {
        try {
            const query = `SELECT geofenceid FROM geofence WHERE accountid = $1 AND fleetid = $2 AND isdeleted = false`;
            let geofenceIds = await this.pgPoolI.Query(query, [accountId, fleetId]);
            geofenceIds = geofenceIds.rows.map((row) => row.geofenceid);
            if (geofenceIds.length === 0) {
                return [];
            }
            const promises = [];
            for (const geofenceId of geofenceIds) {
                promises.push(this.getGeofenceAndRuleWithVehicles(accountId, fleetId, geofenceId));
            }
            const results = await Promise.allSettled(promises);
            return results
                .filter((result) => result.status === 'fulfilled')
                .filter((result) => result.value.actiontypeid !== 'TRIP' && result.value.geofenceinfo.type !== 'polygon')
                .map((result) => result.value);
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeofenceAndRuleWithVehicles(accountId, fleetId, geofenceId, ruleId) {
        try {
            const geoFenceById = await this.getGeofenceById(accountId, null, fleetId, geofenceId);
            let ruleId = await this.pgPoolI.Query(`SELECT ruleid FROM geofenceruleinfo WHERE accountid = $1 AND fleetid = $2 AND geofenceid = $3`, [accountId, fleetId, geofenceId]);
            ruleId = ruleId.rows[0]?.ruleid;
            if (!ruleId) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }
            const ruleById = await this.getRuleById(accountId, null, fleetId, ruleId);
            return {
                geofenceid: geoFenceById?.geofenceid,
                ruleid: ruleById?.ruleid,
                geofencename: geoFenceById?.geofencename,
                geofenceinfo: geoFenceById?.geofenceinfo,
                meta: geoFenceById?.meta,
                isactive: ruleById?.isactive,
                actiontypeid: ruleById?.geofences[0]?.actiontypeid,
                actiontype: ruleById?.geofences[0]?.actiontype,
                vehicles: ruleById?.vehicles,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async updateGeofence(accountId, userId, fleetId, geofenceId, geofenceName, geofenceInfo, meta) {
        try {
            const currentTime = new Date();

            const isExists = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!isExists) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }

            if (geofenceName) {
                const geoNameExist = await this.isGeofenceNewNameExists(accountId, fleetId, geofenceName, geofenceId);
                if (geoNameExist) {
                    throw {
                        errcode: 'GEOFENCE_NAME_EXISTS',
                    };
                }
            }

            if (geofenceInfo.type === 'circle') {
                if (geofenceInfo.radius <= 0) {
                    throw {
                        errcode: 'INVALID_RADIUS',
                    };
                }
                if (geofenceInfo.latlngs.length !== 1) {
                    throw {
                        errcode: 'INVALID_CIRCLE',
                    };
                }
            }

            if (geofenceInfo.type === 'polygon') {
                const polygon = geofenceInfo.latlngs;
                if (polygon.length < 3) {
                    throw {
                        errcode: 'INVALID_POLYGON',
                    };
                }
            }

            const setClauses = [];
            const setValues = [];
            let paramIndex = 1;

            if (geofenceName) {
                setClauses.push(`geofencename = $${paramIndex}`);
                setValues.push(geofenceName);
                paramIndex++;
            }
            if (geofenceInfo) {
                setClauses.push(`geofenceinfo = $${paramIndex}`);
                setValues.push(geofenceInfo);
                paramIndex++;
            }
            if (meta) {
                setClauses.push(`meta = $${paramIndex}`);
                setValues.push(meta);
                paramIndex++;
            }

            setClauses.push(`updatedat = $${paramIndex}`, `updatedby = $${paramIndex + 1}`);
            setValues.push(currentTime, userId);

            const query = `UPDATE geofence 
                    SET ${setClauses.join(', ')}
                    WHERE accountid = $${paramIndex + 2} 
                        AND fleetid = $${paramIndex + 3} 
                        AND geofenceid = $${paramIndex + 4}`;

            await this.pgPoolI.Query(query, [...setValues, accountId, fleetId, geofenceId]);
            return await this.getGeofenceById(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async updateGeofenceStateWithRule(accountId, userId, fleetId, geofenceId, ruleId, isActive) {
        try {
            const currentTime = new Date();

            const isExists = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!isExists) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }

            const isRuleExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isRuleExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
            try {
                let query = `UPDATE geofence 
                            SET isactive = $1, updatedat = $2, updatedby = $3
                            WHERE accountid = $4 
                                AND fleetid = $5 
                                AND geofenceid = $6
                            RETURNING *`;
                await txclient.query(query, [isActive, currentTime, userId, accountId, fleetId, geofenceId]);
                query = `UPDATE geofencerule
                            SET    isactive = $1,
                                updatedat = $2,
                                updatedby = $3
                            WHERE  accountid = $4
                            AND    fleetid = $5
                            AND    ruleid = $6
                        RETURNING *`;
                await txclient.query(query, [isActive, currentTime, userId, accountId, fleetId, ruleId]);
                await this.pgPoolI.TxCommit(txclient);
                return {
                    geofenceid: geofenceId,
                    ruleid: ruleId,
                    isactive: isActive,
                    message: `Geofence ${isActive ? 'activated' : 'deactivated'} successfully`,
                };
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async updateGeofenceState(accountId, userId, fleetId, geofenceId, isActive) {
        try {
            const currentTime = new Date();

            const isExists = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!isExists) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }

            const inUse = await this.isGeofenceInUse(accountId, fleetId, geofenceId);
            if (inUse) {
                throw {
                    errcode: 'GEOFENCE_IN_USE',
                };
            }

            const query = `UPDATE geofence 
                        SET isactive = $1, updatedat = $2, updatedby = $3
                        WHERE accountid = $4 
                            AND fleetid = $5 
                            AND geofenceid = $6
                            AND isdeleted = false
                        RETURNING *`;
            const result = await this.pgPoolI.Query(query, [isActive, currentTime, userId, accountId, fleetId, geofenceId]);
            const rows = result.rows[0];
            const response = {
                fleetid: rows.fleetid,
                geofenceid: rows.geofenceid,
                isactive: rows.isactive,
                message: `Geofence ${isActive ? 'activated' : 'deactivated'} successfully`,
            };
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deactivateExpiredRules() {
        try {
            const query = `
            UPDATE geofencesch.geofencerule
            SET isactive = false,
                updatedat = now()
            WHERE expiry_at IS NOT NULL
            AND expiry_at <= now()
            AND isactive = true
            AND (isdeleted = false OR isdeleted IS NULL)
            RETURNING ruleid;
            `;
            const result =  await this.pgPoolI.Query(query,[]);
            return { updatedCount: result.rowCount, ruleId: result.rows.map(r => r.ruleid) };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deleteGeofence(accountId, userId, fleetId, geofenceId) {
        try {
            const currentTime = new Date();

            const geofenceInfo = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!geofenceInfo) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }

            const isActive = await this.isGeofenceActive(accountId, fleetId, geofenceId);
            if (isActive) {
                throw {
                    errcode: 'GEOFENCE_ACTIVE',
                };
            }

            const inUse = await this.isGeofenceInUse(accountId, fleetId, geofenceId);
            if (inUse) {
                throw {
                    errcode: 'GEOFENCE_IN_USE',
                };
            }

            const query = `UPDATE geofence
                        SET geofencename = $6, isdeleted = true, updatedat = $4, updatedby = $5
                        WHERE accountid = $1 
                        AND fleetid = $2 
                        AND geofenceid = $3`;
            await this.pgPoolI.Query(query, [accountId, fleetId, geofenceId, currentTime, userId, `${geofenceInfo.geofencename}_${Date.now()}_deleted`]);
            return true;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deleteGeofenceWithRule(accountId, userId, fleetId, geofenceId, ruleId) {
        try {
            const isRuleExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isRuleExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const isRuleActive = await this.isGeoRuleActive(accountId, fleetId, ruleId);
            if (isRuleActive) {
                throw {
                    errcode: 'RULE_ACTIVE',
                };
            }

            const isExists = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!isExists) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }

            const isActive = await this.isGeofenceActive(accountId, fleetId, geofenceId);
            if (isActive) {
                throw {
                    errcode: 'GEOFENCE_ACTIVE',
                };
            }

            const isGeoAndRuleBound = await this.pgPoolI.Query(`SELECT * FROM geofenceruleinfo WHERE accountid = $1 AND fleetid = $2 AND geofenceid = $3 AND ruleid = $4`, [
                accountId,
                fleetId,
                geofenceId,
                ruleId,
            ]);
            if (isGeoAndRuleBound.rows.length === 0) {
                throw {
                    errcode: 'INVALID_GEOFENCE_AND_RULE',
                };
            }

            await this.deleteRule(accountId, userId, fleetId, ruleId);
            await this.deleteGeofence(accountId, userId, fleetId, geofenceId);
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listGeoRules(accountId, userId, fleetId, geofenceId) {
        try {
            const isExists = await this.isGeofenceExists(accountId, fleetId, geofenceId);
            if (!isExists) {
                throw {
                    errcode: 'GEOFENCE_NOT_FOUND',
                };
            }

            const query = `SELECT r.ruleid, r.rulename, r.ruletypeid, r.isactive, r.createdat, r.createdby, a.actiontype
                            FROM geofencerule r, geofenceruleinfo gr, rulegeofenceaction a
                            WHERE gr.accountid = $1     
                                AND gr.fleetid = $2 
                                AND gr.geofenceid = $3 
                                AND r.accountid = gr.accountid 
                                AND r.fleetid = gr.fleetid 
                                AND r.ruleid = gr.ruleid
                                AND a.actiontypeid = gr.actiontypeid
                                AND r.isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceId]);
            const rows = result.rows;
            const response = {
                geofenceid: geofenceId,
                rules: rows.map((row) => ({
                    ruleid: row.ruleid,
                    rulename: row.rulename,
                    ruletypeid: row.ruletypeid,
                    isactive: row.isactive,
                    actiontype: row.actiontype,
                    createdat: convertEpochToIST(Number(row.createdat)),
                    createdby: row.createdby,
                })),
            };
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listRuleTypes() {
        try {
            const query = `SELECT ruletypeid, ruletype FROM geofenceruletype`;
            const result = await this.pgPoolI.Query(query);
            const rows = result.rows;
            const response = rows.map((row) => ({
                ruletypeid: row.ruletypeid,
                ruletype: row.ruletype,
            }));
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listActionTypes() {
        try {
            const query = `SELECT actiontypeid, actiontype FROM rulegeofenceaction`;
            const result = await this.pgPoolI.Query(query);
            const rows = result.rows;
            let response = rows.map((row) => ({
                actiontypeid: row.actiontypeid,
                actiontype: row.actiontype,
            }));
            response = response.filter((row) => row.actiontypeid !== this.actionTypes.Trip);
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async createRule(accountId, userId, fleetId, rule) {
        try {
            const ruleNameExist = await this.isGeoRuleNameExists(accountId, fleetId, rule.rulename);
            if (ruleNameExist) {
                throw {
                    errcode: 'RULE_NAME_EXISTS',
                };
            }

            const ruleGeofences = rule.rulegeoinfo;
            let promises = [];
            for (const ruleGeofence of ruleGeofences) {
                promises.push(this.isGeofenceActive(accountId, fleetId, ruleGeofence.geofenceid));
            }
            try {
                const isActive = await Promise.all(promises);
                if (isActive.some((isActive) => !isActive)) {
                    throw {
                        errcode: 'GEOFENCE_NOT_ACTIVE',
                    };
                }
            } catch (error) {
                throw {
                    errcode: 'GEOFENCE_NOT_ACTIVE',
                };
            }

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }

            try {
                const ruleId = this.geofenceSvcUtils.getUUID();
                const query = `INSERT INTO geofencerule (
                accountid, fleetid, ruleid, rulename, ruletypeid, isactive, rulemeta, expiry_at, createdat, createdby, updatedat, updatedby) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`;
                await txclient.query(query, [accountId, fleetId, ruleId, rule.rulename, rule.ruletypeid, true, rule.meta, rule.expiryAt, 
                    new Date(), userId, new Date(), userId]);

                promises = [];
                for (const ruleGeofence of ruleGeofences) {
                    const query = `INSERT INTO geofenceruleinfo (accountid, fleetid, ruleid, geofenceid, seqno, actiontypeid, 
                    geofencerulemeta, updatedat, updatedby) 
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
                    promises.push(
                        txclient.query(query, [accountId, fleetId, ruleId, ruleGeofence.geofenceid, Number(ruleGeofence.seqno), ruleGeofence.actiontypeid, ruleGeofence.meta, new Date(), userId])
                    );
                }
                await Promise.all(promises);
                await this.pgPoolI.TxCommit(txclient);

                return await this.getRuleById(accountId, userId, fleetId, ruleId);
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw error;
            }
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listRules(accountId, userId, fleetIds) {
        try {
            const query = `SELECT r.fleetid, r.ruleid, r.rulename, r.rulemeta, rt.ruletype, r.isactive FROM geofencerule r, 
                            geofenceruletype rt 
                            WHERE r.accountid = $1 
                                AND r.fleetid = ANY($2::uuid[]) 
                                AND rt.ruletypeid = r.ruletypeid
                                AND r.isdeleted = false
                                AND (r.expiry_at IS NULL OR r.expiry_at > now())
                                ORDER BY r.createdat DESC`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetIds]);
            const rows = result.rows;
            const response = rows.map((row) => ({
                fleetid: row.fleetid,
                ruleid: row.ruleid,
                rulename: row.rulename,
                rulemeta: row.rulemeta,
                ruletype: row.ruletype,
                isactive: row.isactive,
            }));
            return response;
        } catch (error) {
            this.logger.error(error.toString());
            throw error;
        }
    }

    async getRuleById(accountId, userId, fleetId, ruleId) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }
            const promises = [];
            let query = `SELECT r.fleetid, r.ruleid, r.rulename, r.rulemeta, rt.ruletype, r.ruletypeid, r.isactive FROM geofencerule r, 
                            geofenceruletype rt 
                            WHERE r.accountid = $1 
                                AND r.fleetid = $2 
                                AND r.ruleid = $3
                                AND (r.expiry_at IS NULL OR r.expiry_at > now())
                                AND rt.ruletypeid = r.ruletypeid`;
            promises.push(this.pgPoolI.Query(query, [accountId, fleetId, ruleId]));
            query = `SELECT rg.geofenceid, g.geofencename, g.geofenceinfo, g.meta, rg.seqno, rg.actiontypeid, ga.actiontype, 
                    rg.geofencerulemeta 
                    FROM geofenceruleinfo rg, geofence g, rulegeofenceaction ga
                    WHERE rg.accountid = $1 
                        AND rg.fleetid = $2 
                        AND rg.ruleid = $3 
                        AND g.accountid = rg.accountid 
                        AND g.fleetid = rg.fleetid 
                        AND (r.expiry_at IS NULL OR r.expiry_at > now())
                        AND g.geofenceid = rg.geofenceid
                        AND ga.actiontypeid = rg.actiontypeid`;
            promises.push(this.pgPoolI.Query(query, [accountId, fleetId, ruleId]));
            query = `SELECT gv.vinno, v.license_plate as regno
                        FROM   geofencerulevehicle gv, ${this.config.schemas.fmscoresch}.fleet_vehicle fv, ${this.config.schemas.fmscoresch}.vehicle v
                        WHERE  gv.accountid = $1
                            AND gv.fleetid = $2
                            AND gv.ruleid = $3
                            AND fv.accountid = gv.accountid
                            AND fv.vinno = gv.vinno
                            AND v.vinno = fv.vinno`;
            promises.push(this.pgPoolI.Query(query, [accountId, fleetId, ruleId]));
            query = `SELECT gf.subfleetid,
                            f.name
                        FROM   geofencerulefleet gf,
                            ${this.config.schemas.fmscoresch}.fleet_tree f
                        WHERE  gf.accountid = $1
                            AND gf.fleetid = $2
                            AND gf.ruleid = $3
                            AND f.accountid = gf.accountid
                            AND f.fleetid = gf.subfleetid `;
            promises.push(this.pgPoolI.Query(query, [accountId, fleetId, ruleId]));
            query = ` SELECT gu.userid,
                            u.displayname,
                            gu.alertmeta
                        FROM   geofenceruleuser gu,
                            ${this.config.schemas.fmscoresch}.users u
                        WHERE  gu.accountid = $1
                            AND gu.fleetid = $2
                            AND gu.ruleid = $3
                            AND u.userid = gu.userid`;
            promises.push(this.pgPoolI.Query(query, [accountId, fleetId, ruleId]));
            const [ruleResult, ruleGeoResult, ruleVehicleResult, ruleFleetResult, ruleUserResult] = await Promise.all(promises);
            const rule = ruleResult.rows[0];
            const ruleGeo = ruleGeoResult.rows;
            const ruleVehicle = ruleVehicleResult.rows;
            const ruleFleet = ruleFleetResult.rows;
            const ruleUser = ruleUserResult.rows;
            const response = {
                fleetid: rule.fleetid,
                ruleid: rule.ruleid,
                rulename: rule.rulename,
                ruletypeid: rule.ruletypeid,
                ruletype: rule.ruletype,
                isactive: rule.isactive,
                rulemeta: rule.rulemeta,
                geofences: ruleGeo.map((geo) => ({
                    geofenceid: geo.geofenceid,
                    geofencename: geo.geofencename,
                    geofenceinfo: geo.geofenceinfo,
                    meta: geo.meta,
                    seqno: geo.seqno,
                    actiontypeid: geo.actiontypeid,
                    actiontype: geo.actiontype,
                    geofencerulemeta: geo.geofencerulemeta,
                })),
                vehicles: ruleVehicle.map((vehicle) => ({
                    vinno: vehicle.vinno,
                    regno: vehicle.regno,
                })),
                sfleets: ruleFleet.map((fleet) => ({
                    subfleetid: fleet.subfleetid,
                    name: fleet.name,
                })),
                users: ruleUser.map((user) => ({
                    userid: user.userid,
                    name: user.displayname,
                    alertmeta: user.alertmeta,
                })),
            };
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async updateRule(accountId, userId, fleetId, ruleId, ruleName, ruleTypeId, meta, ruleGeoInfo) {
        try {
            const currentTime = new Date();

            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            let promises = [];
            for (const ruleGeofence of ruleGeoInfo) {
                promises.push(this.isGeofenceActive(accountId, fleetId, ruleGeofence.geofenceid));
            }
            try {
                const isActive = await Promise.all(promises);
                if (isActive.some((isActive) => !isActive)) {
                    throw {
                        errcode: 'GEOFENCE_NOT_ACTIVE',
                    };
                }
            } catch (error) {
                throw {
                    errcode: 'GEOFENCE_NOT_ACTIVE',
                };
            }

            const ruleNameExist = await this.isGeoRuleNewNameExists(accountId, fleetId, ruleName, ruleId);
            if (ruleNameExist) {
                throw {
                    errcode: 'RULE_NAME_EXISTS',
                };
            }

            const setClauses = [];
            const setValues = [];
            let paramIndex = 1;

            if (ruleName) {
                setClauses.push(`rulename = $${paramIndex}`);
                setValues.push(ruleName);
                paramIndex++;
            }

            if (ruleTypeId) {
                setClauses.push(`ruletypeid = $${paramIndex}`);
                setValues.push(ruleTypeId);
                paramIndex++;
            }

            if (meta) {
                setClauses.push(`rulemeta = $${paramIndex}`);
                setValues.push(meta);
                paramIndex++;
            }

            setClauses.push(`updatedat = $${paramIndex}`, `updatedby = $${paramIndex + 1}`);
            setValues.push(currentTime, userId);

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }

            try {
                let query = `UPDATE geofencerule SET ${setClauses.join(', ')} 
                            WHERE accountid = $${paramIndex + 2} 
                                AND fleetid = $${paramIndex + 3} 
                                AND ruleid = $${paramIndex + 4} 
                                RETURNING *`;

                const result = await txclient.query(query, [...setValues, accountId, fleetId, ruleId]);
                const rows = result.rows[0];

                query = `DELETE FROM geofenceruleinfo WHERE accountid = $1 
                        AND fleetid = $2 
                        AND ruleid = $3`;
                await txclient.query(query, [accountId, fleetId, ruleId]);

                promises = [];
                for (const ruleGeofence of ruleGeoInfo) {
                    query = `INSERT INTO geofenceruleinfo (accountid, fleetid, ruleid, geofenceid, seqno, actiontypeid, geofencerulemeta, updatedat, updatedby) 
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
                    promises.push(
                        txclient.query(query, [accountId, fleetId, ruleId, ruleGeofence.geofenceid, Number(ruleGeofence.seqno), ruleGeofence.actiontypeid, ruleGeofence.meta, currentTime, userId])
                    );
                }
                await Promise.all(promises);

                const response = {
                    ruleid: rows.ruleid,
                    rulename: rows.rulename,
                    ruletypeid: rows.ruletypeid,
                    isactive: rows.isactive,
                    rulemeta: rows.rulemeta,
                };
                await this.pgPoolI.TxCommit(txclient);
                return response;
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw error;
            }
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async updateRuleState(accountId, userId, fleetId, ruleId, isActive) {
        try {
            const currentTime = new Date();

            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const query = `UPDATE geofencerule
                            SET    isactive = $1,
                                updatedat = $2,
                                updatedby = $3
                            WHERE  accountid = $4
                            AND    fleetid = $5
                            AND    ruleid = $6
                            AND    isdeleted = false
                        RETURNING *`;
            const result = await this.pgPoolI.Query(query, [isActive, currentTime, userId, accountId, fleetId, ruleId]);
            const rows = result.rows[0];
            const response = {
                fleetid: rows.fleetid,
                ruleid: rows.ruleid,
                isactive: rows.isactive,
                message: `Rule ${isActive ? 'activated' : 'deactivated'} successfully`,
            };
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deleteRule(accountId, userId, fleetId, ruleId) {
        try {
            const currentTime = new Date();

            const ruleInfo = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!ruleInfo) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const isActive = await this.isGeoRuleActive(accountId, fleetId, ruleId);
            if (isActive) {
                throw {
                    errcode: 'RULE_ACTIVE',
                };
            }

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }

            try {
                const promises = [];
                promises.push(
                    txclient.query(
                        `DELETE FROM geofenceruleinfo 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND ruleid = $3`,
                        [accountId, fleetId, ruleId]
                    )
                );
                promises.push(
                    txclient.query(
                        `DELETE FROM geofencerulevehicle
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND ruleid = $3`,
                        [accountId, fleetId, ruleId]
                    )
                );
                promises.push(
                    txclient.query(
                        `DELETE FROM geofencerulefleet 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND ruleid = $3`,
                        [accountId, fleetId, ruleId]
                    )
                );
                promises.push(
                    txclient.query(
                        `DELETE FROM geofenceruleuser 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND ruleid = $3`,
                        [accountId, fleetId, ruleId]
                    )
                );
                await Promise.all(promises);
                await txclient.query(
                    `UPDATE geofencerule 
                        SET rulename = $6, isdeleted = true, updatedat = $4, updatedby = $5
                        WHERE accountid = $1 
                            AND fleetid = $2 
                            AND ruleid = $3
                        RETURNING *`,
                    [accountId, fleetId, ruleId, currentTime, userId, `${ruleInfo.rulename}_${Date.now()}_deleted`]
                );
                await this.pgPoolI.TxCommit(txclient);
                return true;
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw error;
            }
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listAsinablRuleVehs(accountId, userId, fleetIds, ruleId) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetIds[0], ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            let query = ` SELECT    fv.vinno,
                                    COALESCE(v.license_plate, v.vinno) as regno,
                                    fv.fleetid
                            FROM      ${this.config.schemas.fmscoresch}.fleet_vehicle fv
                            INNER JOIN ${this.config.schemas.fmscoresch}.vehicle v
                            ON        v.vinno = fv.vinno
                            LEFT JOIN geofencerulevehicle gv
                            ON        gv.vinno = fv.vinno
                            AND       gv.accountid = fv.accountid
                            AND       gv.fleetid = ANY($2::uuid[])
                            AND       gv.ruleid = $3
                            WHERE     fv.accountid = $1
                            AND       fv.fleetid = ANY($2::uuid[])
                            AND       gv.vinno IS NULL
                            ORDER BY  fv.fleetid`;

            let result = await this.pgPoolI.Query(query, [accountId, fleetIds, ruleId]);
            const rows = result.rows;
            let response = rows.map((row) => ({
                vinno: row.vinno,
                regno: row.regno,
                fleetid: row.fleetid
            }));
            const enableSubscribedVins = this.config.geofenceFeature?.getSubscribedVinsOnly ? true : false;
            if (!enableSubscribedVins) {
                return response;
            }
            query = `SELECT vinno FROM ${this.config.schemas.fmscoresch}.account_vehicle_subscription WHERE accountid = $1`;
            result = await this.pgPoolI.Query(query, [accountId]);
            const vinList = result.rows.map((row) => row.vinno);
            response = response.filter((row) => vinList.includes(row.vinno));
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listAsinablRuleFleets(accountId, userId, fleetIds, ruleId) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetIds[0], ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const query = `  SELECT    f.fleetid,
                                    f.name
                            FROM      ${this.config.schemas.fmscoresch}.fleet_tree f
                            LEFT JOIN geofencerulefleet gf
                            ON        f.accountid = gf.accountid
                            AND       f.fleetid = gf.subfleetid
                            AND       gf.fleetid = $2
                            AND       gf.ruleid = $3
                            WHERE     f.accountid = $1
                            AND       f.fleetid = ANY($4::uuid[])
                            AND       gf.subfleetid IS NULL
                            ORDER BY  f.fleetid`;

            const result = await this.pgPoolI.Query(query, [accountId, fleetIds[0], ruleId, fleetIds]);
            const rows = result.rows;
            const response = rows.map((row) => ({
                fleetid: row.fleetid,
                name: row.name,
            }));
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async listAsinablRuleUsers(accountId, userId, fleetIds, ruleId) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetIds[0], ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const query = ` SELECT    fu.userid,
                                    u.displayname,
                                    fu.fleetid
                            FROM      ${this.config.schemas.fmscoresch}.users u
                            JOIN      ${this.config.schemas.fmscoresch}.user_fleet fu
                            ON        fu.userid = u.userid
                            LEFT JOIN geofenceruleuser gu
                            ON        gu.userid = fu.userid
                            AND       gu.accountid = fu.accountid
                            AND       gu.fleetid = ANY($2::uuid[])
                            AND       gu.ruleid = $3
                            WHERE     fu.accountid = $1
                            AND       fu.fleetid = ANY($2::uuid[])
                            AND       gu.userid IS NULL
                            ORDER BY  u.displayname`;

            const result = await this.pgPoolI.Query(query, [accountId, fleetIds, ruleId]);
            const rows = result.rows;
            const response = rows.map((row) => ({
                userid: row.userid,
                displayname: row.displayname,
                fleetid: row.fleetid,
            }));
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async addRuleVehs(accountId, userId, fleetId, ruleId, vinnos) {
        try {
            const currentDate = new Date();
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            vinnos = Array.from(new Set(vinnos));

            const vehiclesAdded = [];
            const vehiclesSkipped = [];

            const promises = [];
            for (const vinno of vinnos) {
                promises.push(this.isRuleVehicleExists(accountId, fleetId, vinno, ruleId));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (result.isAssignable) {
                    vehiclesAdded.push(result.vinno);
                } else {
                    vehiclesSkipped.push(result.vinno);
                }
            }

            if (vehiclesAdded.length > 0) {
                const values = vehiclesAdded.map((_, index) => `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`).join(', ');

                const query = `INSERT INTO geofencerulevehicle (accountid, fleetid, ruleid, vinno, createdat, createdby)
                                VALUES ${values}`;

                const params = [];
                vehiclesAdded.forEach((vinno) => {
                    params.push(accountId, fleetId, ruleId, vinno, currentDate, userId);
                });

                const [txclient, err] = await this.pgPoolI.StartTransaction();
                if (err) {
                    throw {
                        errcode: 'INTERNAL_ERROR',
                    };
                }

                try {
                    await txclient.query(query, params);
                    await this.pgPoolI.TxCommit(txclient);
                } catch (error) {
                    await this.pgPoolI.TxRollback(txclient);
                    throw error;
                }
            }
            return {
                vehiclesAdded: vehiclesAdded,
                vehiclesSkipped: vehiclesSkipped,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deleteRuleVehs(accountId, userId, fleetId, ruleId, vinnos) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            vinnos = Array.from(new Set(vinnos));

            const vehiclesDeleted = [];
            const vehiclesNotExists = [];

            const promises = [];
            for (const vinno of vinnos) {
                promises.push(this.isRuleVehicleExistDeletable(accountId, fleetId, vinno, ruleId));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (result.isDeletable) {
                    vehiclesDeleted.push(result.vinno);
                } else {
                    vehiclesNotExists.push(result.vinno);
                }
            }

            const query = `DELETE FROM geofencerulevehicle 
                                WHERE accountid = $1 AND fleetid = $2 AND ruleid = $3 AND vinno = ANY($4::text[])`;
            const params = [accountId, fleetId, ruleId, vehiclesDeleted];

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }

            try {
                await txclient.query(query, params);
                await this.pgPoolI.TxCommit(txclient);
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw error;
            }
            return {
                vehiclesDeleted: vehiclesDeleted,
                vehiclesNotExists: vehiclesNotExists,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async addRuleFleets(accountId, userId, fleetId, ruleId, fleets, cookie) {
        try {
            const currentDate = new Date();
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            fleets = Array.from(new Set(fleets));

            const fleetsAdded = [];
            const fleetsSkipped = [];

            const subfleets = await this.getRecursiveFleets(accountId, fleetId, cookie, true);
            for (const fleet of fleets) {
                if (subfleets.includes(fleet)) {
                    fleetsAdded.push(fleet);
                } else {
                    fleetsSkipped.push(fleet);
                }
            }

            const promises = [];
            for (const fleet of fleetsAdded) {
                promises.push(this.isRuleFleetExists(accountId, fleetId, fleet, ruleId));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (!result.isAssignable) {
                    fleetsSkipped.push(result.fleet);
                    fleetsAdded.splice(fleetsAdded.indexOf(result.fleet), 1);
                }
            }

            if (fleetsAdded.length > 0) {
                const values = fleetsAdded
                    .map(
                        (_, index) =>
                            `($${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8}
                            )`
                    )
                    .join(', ');

                const query = `INSERT INTO geofencerulefleet (accountid, fleetid, ruleid, subfleetid, createdat, createdby, updatedat, updatedby)
                                VALUES ${values}`;

                const params = [];
                fleetsAdded.forEach((fleet) => {
                    params.push(accountId, fleetId, ruleId, fleet, currentDate, userId, currentDate, userId);
                });

                const [txclient, err] = await this.pgPoolI.StartTransaction();
                if (err) {
                    throw {
                        errcode: 'INTERNAL_ERROR',
                    };
                }

                try {
                    await txclient.query(query, params);
                    await this.pgPoolI.TxCommit(txclient);
                } catch (error) {
                    await this.pgPoolI.TxRollback(txclient);
                    throw error;
                }
            }
            return {
                fleetsAdded: fleetsAdded,
                fleetsSkipped: fleetsSkipped,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deleteRuleFleets(accountId, userId, fleetId, ruleId, fleets) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            fleets = Array.from(new Set(fleets));

            const fleetsDeleted = [];
            const fleetsNotExists = [];

            const promises = [];
            for (const fleet of fleets) {
                promises.push(this.isRuleFleetExistDeletable(accountId, fleetId, fleet, ruleId));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (result.isDeletable) {
                    fleetsDeleted.push(result.fleet);
                } else {
                    fleetsNotExists.push(result.fleet);
                }
            }

            const query = `DELETE FROM geofencerulefleet 
                                WHERE accountid = $1 AND fleetid = $2 AND ruleid = $3 AND subfleetid = ANY($4::uuid[])`;

            const params = [accountId, fleetId, ruleId, fleetsDeleted];

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }

            try {
                await txclient.query(query, params);
                await this.pgPoolI.TxCommit(txclient);
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw error;
            }
            return {
                fleetsDeleted: fleetsDeleted,
                fleetsNotExists: fleetsNotExists,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async addRuleUsers(accountId, userId, fleetId, ruleId, users, alertmeta) {
        try {
            const currentDate = new Date();
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            users = Array.from(new Set(users));

            const usersAdded = [];
            const usersSkipped = [];

            const promises = [];
            for (const user of users) {
                promises.push(this.isUserInFleet(accountId, fleetId, ruleId, user));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (result.isAssignable) {
                    usersAdded.push(result.user);
                } else {
                    usersSkipped.push(result.user);
                }
            }

            if (usersAdded.length > 0) {
                const values = usersAdded
                    .map(
                        (_, index) =>
                            `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}, $${index * 9 + 9}
                            )`
                    )
                    .join(', ');

                const query = `INSERT INTO geofenceruleuser (accountid, fleetid, ruleid, userid, alertmeta, createdat, createdby, updatedat, updatedby)
                                VALUES ${values}`;

                const params = [];
                usersAdded.forEach((user) => {
                    params.push(accountId, fleetId, ruleId, user, alertmeta, currentDate, userId, currentDate, userId);
                });

                const [txclient, err] = await this.pgPoolI.StartTransaction();
                if (err) {
                    throw {
                        errcode: 'INTERNAL_ERROR',
                    };
                }

                try {
                    await txclient.query(query, params);
                    await this.pgPoolI.TxCommit(txclient);
                } catch (error) {
                    await this.pgPoolI.TxRollback(txclient);
                    throw error;
                }
            }
            return {
                usersAdded: usersAdded,
                usersSkipped: usersSkipped,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async updateUserNoti(accountId, userIdAuth, fleetId, ruleId, userId, alertmeta) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            const isUserInRule = await this.isUserInFleet(accountId, fleetId, ruleId, userId);
            if (isUserInRule.isAssignable) {
                throw {
                    errcode: 'USER_NOT_FOUND_IN_RULE',
                };
            }

            const query = `UPDATE geofenceruleuser SET alertmeta = $1 WHERE accountid = $2 AND fleetid = $3 AND ruleid = $4 AND userid = $5`;
            const params = [alertmeta, accountId, fleetId, ruleId, userId];

            await this.pgPoolI.Query(query, params);
            return {
                userid: userId,
                alertmeta: alertmeta,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async deleteRuleUsers(accountId, userId, fleetId, ruleId, users) {
        try {
            const isExists = await this.isGeoRuleExists(accountId, fleetId, ruleId);
            if (!isExists) {
                throw {
                    errcode: 'RULE_NOT_FOUND',
                };
            }

            users = Array.from(new Set(users));

            const usersDeleted = [];
            const usersNotExists = [];

            const promises = [];
            for (const user of users) {
                promises.push(this.isRuleUserExistDeletable(accountId, fleetId, user, ruleId));
            }

            const results = await Promise.all(promises);
            for (const result of results) {
                if (result.isDeletable) {
                    usersDeleted.push(result.user);
                } else {
                    usersNotExists.push(result.user);
                }
            }

            const query = `DELETE FROM geofenceruleuser 
                                WHERE accountid = $1 AND fleetid = $2 AND ruleid = $3 AND userid = ANY($4::uuid[])`;

            const params = [accountId, fleetId, ruleId, usersDeleted];

            const [txclient, err] = await this.pgPoolI.StartTransaction();
            if (err) {
                throw {
                    errcode: 'INTERNAL_ERROR',
                };
            }

            try {
                await txclient.query(query, params);
                await this.pgPoolI.TxCommit(txclient);
            } catch (error) {
                await this.pgPoolI.TxRollback(txclient);
                throw error;
            }
            return {
                usersDeleted: usersDeleted,
                usersNotExists: usersNotExists,
            };
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    //non api functions
    async isGeofenceExists(accountId, fleetId, geofenceId) {
        try {
            const query = `SELECT * FROM geofence 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND geofenceid = $3
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            throw error;
        }
    }

    async isGeofenceNameExists(accountId, fleetId, geofenceName) {
        const query = `SELECT * FROM geofence 
                        WHERE accountid = $1 
                            AND fleetid = $2 
                            AND geofencename = $3
                            AND isdeleted = false`;
        const geoExist = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceName]);
        return geoExist.rows.length > 0;
    }

    async isGeofenceNewNameExists(accountId, fleetId, geofenceName, geofenceId) {
        const query = `SELECT * FROM geofence 
                        WHERE accountid = $1 
                            AND fleetid = $2 
                            AND geofencename = $3
                            AND geofenceid != $4
                            AND isdeleted = false`;
        const geoExist = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceName, geofenceId]);
        return geoExist.rows.length > 0;
    }

    async isGeofenceActive(accountId, fleetId, geofenceId) {
        try {
            const query = `SELECT isactive FROM geofence 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND geofenceid = $3
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceId]);
            return result.rows[0].isactive;
        } catch (error) {
            throw error;
        }
    }

    async isGeofenceInUse(accountId, fleetId, geofenceId) {
        try {
            const query = `SELECT COUNT(*) FROM geofenceruleinfo WHERE accountid = $1 AND fleetid = $2 AND geofenceid = $3`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, geofenceId]);
            return result.rows[0].count > 0;
        } catch (error) {
            throw error;
        }
    }

    async isGeoRuleNameExists(accountId, fleetId, ruleName) {
        try {
            const query = `SELECT rulename FROM geofencerule 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND rulename = $3
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleName]);
            return result.rows.length > 0;
        } catch (error) {
            throw error;
        }
    }

    async isGeoRuleNewNameExists(accountId, fleetId, ruleName, ruleId) {
        try {
            const query = `SELECT rulename FROM geofencerule 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND rulename = $3
                                AND ruleid != $4
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleName, ruleId]);
            return result.rows.length > 0;
        } catch (error) {
            throw error;
        }
    }

    async isGeoRuleExists(accountId, fleetId, ruleId) {
        try {
            const query = `SELECT * FROM geofencerule 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND ruleid = $3
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            throw error;
        }
    }

    async isGeoRuleActive(accountId, fleetId, ruleId) {
        try {
            const query = `SELECT isactive FROM geofencerule 
                            WHERE accountid = $1 
                                AND fleetid = $2 
                                AND ruleid = $3
                                AND isdeleted = false`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId]);
            return result.rows[0].isactive;
        } catch (error) {
            throw error;
        }
    }

    async isRuleVehicleExists(accountId, fleetId, vinno, ruleId) {
        try {
            const query = `SELECT fv.vinno FROM ${this.config.schemas.fmscoresch}.fleet_vehicle fv
                            LEFT JOIN geofencerulevehicle gv
                            ON        gv.vinno = fv.vinno
                            AND       gv.accountid = fv.accountid
                            AND       gv.fleetid = $2
                            AND       gv.ruleid = $3
                            WHERE     fv.accountid = $1 AND fv.vinno = $4 AND gv.vinno IS NULL`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId, vinno]);
            return result.rows.length > 0 ? { isAssignable: true, vinno: result.rows[0].vinno } : { isAssignable: false, vinno: vinno };
        } catch (error) {
            throw error;
        }
    }

    async isRuleVehicleExistDeletable(accountId, fleetId, vinno, ruleId) {
        try {
            const query = `SELECT gv.vinno FROM geofencerulevehicle gv
                            WHERE     gv.accountid = $1 AND gv.fleetid = $2 AND gv.ruleid = $3 AND gv.vinno = $4`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId, vinno]);
            return result.rows.length > 0 ? { isDeletable: true, vinno: result.rows[0].vinno } : { isDeletable: false, vinno: vinno };
        } catch (error) {
            throw error;
        }
    }

    async isRuleFleetExists(accountId, fleetId, fleet, ruleId) {
        try {
            const assignmentQuery = `SELECT subfleetid FROM geofencerulefleet 
                                    WHERE accountid = $1 AND fleetid = $2 AND ruleid = $3 AND subfleetid = $4`;
            const assignmentResult = await this.pgPoolI.Query(assignmentQuery, [accountId, fleetId, ruleId, fleet]);

            return assignmentResult.rows.length > 0 ? { isAssignable: false, fleet: fleet } : { isAssignable: true, fleet: fleet };
        } catch (error) {
            throw error;
        }
    }

    async isRuleFleetExistDeletable(accountId, fleetId, fleet, ruleId) {
        try {
            const query = `SELECT subfleetid FROM geofencerulefleet WHERE accountid = $1 AND fleetid = $2 AND ruleid = $3 AND subfleetid = $4`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId, fleet]);
            return result.rows.length > 0 ? { isDeletable: true, fleet: fleet } : { isDeletable: false, fleet: fleet };
        } catch (error) {
            throw error;
        }
    }

    async isUserInFleet(accountId, fleetId, ruleId, userId) {
        try {
            const query = `SELECT u.userid FROM ${this.config.schemas.fmscoresch}.user_fleet u
                            LEFT JOIN geofenceruleuser gu
                            ON gu.userid = u.userid 
                            AND gu.accountid = u.accountid 
                            AND gu.fleetid = $2
                            AND gu.ruleid = $3
                            WHERE u.accountid = $1 
                            AND u.fleetid = $2 
                            AND u.userid = $4 
                            AND gu.userid IS NULL`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId, userId]);
            return result.rows.length > 0 ? { isAssignable: true, user: userId } : { isAssignable: false, user: userId };
        } catch (error) {
            throw error;
        }
    }

    async isRuleUserExistDeletable(accountId, fleetId, user, ruleId) {
        try {
            const query = `SELECT userid FROM geofenceruleuser WHERE accountid = $1 AND fleetid = $2 AND ruleid = $3 AND userid = $4`;
            const result = await this.pgPoolI.Query(query, [accountId, fleetId, ruleId, user]);
            return result.rows.length > 0 ? { isDeletable: true, user: user } : { isDeletable: false, user: user };
        } catch (error) {
            throw error;
        }
    }

    //utils
    async getRecursiveFleets(accountId, fleetId, cookie, recursive = false) {
        try {
            const fleetIds = await this.geofenceSvcUtils.getRecursiveFleets(accountId, fleetId, cookie, recursive);
            return fleetIds;
        } catch (error) {
            this.logger.error(error.toString());
            throw error;
        }
    }

    async getUserFleets(accountid, userid) {
        try {
            const allFleetsQuery = `
              SELECT * FROM ${this.config.schemas.fmscoresch}.get_all_fleets_path_from_root($1, $2)
            `;
            const allFleets = await this.pgPoolI.Query(allFleetsQuery, [accountid, userid]);
            if (allFleets.rowCount === 0) {
                return null;
            }

            const accessibleFleetsQuery = `
              SELECT DISTINCT fleetid 
              FROM ${this.config.schemas.fmscoresch}.fleet_user_role 
              WHERE accountid = $1 AND userid = $2
            `;
            const accessibleFleets = await this.pgPoolI.Query(accessibleFleetsQuery, [accountid, userid]);
            if (accessibleFleets.rowCount === 0) {
                return null;
            }

            const accessibleFleetIds = accessibleFleets.rows.map((row) => row.fleetid);

            const childFleetsQuery = `
              WITH RECURSIVE fleet_children AS (
                SELECT ft.fleetid
                FROM ${this.config.schemas.fmscoresch}.fleet_tree ft
                WHERE ft.accountid = $1
                  AND ft.fleetid = ANY($2)
                  AND ft.isdeleted = false
      
                UNION ALL
      
                SELECT ft.fleetid
                FROM ${this.config.schemas.fmscoresch}.fleet_tree ft
                JOIN fleet_children fc ON ft.pfleetid = fc.fleetid
                WHERE ft.accountid = $1 AND ft.isdeleted = false
      
              )
              SELECT DISTINCT fleetid FROM fleet_children;
            `;

            const allAllowedFleets = await this.pgPoolI.Query(childFleetsQuery, [accountid, accessibleFleetIds]);
            const allowedFleetIds = new Set(allAllowedFleets?.rows?.map((row) => row.fleetid) || []);
            const filteredFleets = allFleets?.rows?.filter((fleet) => allowedFleetIds.has(fleet.fleetid)) || [];
            const fleets = filteredFleets?.map((obj) => obj.fleetid) || [];

            return fleets;
        } catch (error) {
            this.logger.error(error.toString());
            throw error;
        }
    }

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
