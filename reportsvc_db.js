import { v4 as uuidv4 } from 'uuid';
import ReportSvcUtils from './reportsvcutils.js';

export default class ReportSvcDB {
    constructor(chClientI, pgPoolI, logger, config) {
        this.chClientI = chClientI;
        this.pgPoolI = pgPoolI;
        this.logger = logger;
        this.config = config;
        this.reportSvcUtils = new ReportSvcUtils(logger, config);
    }

    async getGeoAlertVehReport(accountId, userId, fleetId, vinnos, starttime, endtime) {
        const currtime = Date.now();

        // Validate time range
        if (starttime >= endtime || endtime > currtime || starttime < 0) {
            throw {
                errcode: 'INVALID_TIME_RANGE',
            };
        }

        try {
            // const fleetLists = this.getVehicleFleets(accountId, vinnos);
            // if(!fleetLists.length){
            //     return [];
            // }
            // Get the time buckets for the given time range
            const timeBuckets = this.reportSvcUtils.clhTimeBucketRange(starttime, endtime);
            if (timeBuckets.length === 0) {
                throw {
                    errcode: 'NO_VALID_TIME_BUCKETS',
                };
            }

            const finalResults = [];

            const promises = timeBuckets.map((bucket) => {
                const query = `
                    SELECT
                        ruleid,
                        vinno, 
                        alerttime, 
                        alerttype, 
                        alertid, 
                        odo, 
                        speed, 
                        soc, 
                        lat, 
                        lng, 
                        alertdata,
                        proctime
                    FROM lmmdata.geoalertdata_${bucket} 
                    WHERE vinno IN (${vinnos.map((vinno) => `'${vinno}'`).join(',')})
                        AND alerttime >= ${starttime}
                        AND alerttime <= ${endtime}
                        AND lng != 0
                        AND lat != 0
                        AND accountid = '${accountId}'
                `;
                return this.chClientI.query(query);
            });
            const results = await Promise.all(promises);
            let flattenedData = results.flatMap((result) => result.data || []);
            const ruleDetailsMap = await this.getRuleDetailsMap(flattenedData.map((result) => result.ruleid));
            const vehDetailsMap = await this.getVehDetailsMap(flattenedData.map((result) => result.vinno));
            flattenedData.forEach((result) => {
                const ruleDetail = ruleDetailsMap.get(result.ruleid);
                const regno = vehDetailsMap.get(result.vinno);
                if (ruleDetail) {
                    result.rulename = ruleDetail.rulename;
                    const firstGeofence = ruleDetail.geofences[0];
                    if (firstGeofence) {
                        result.geofencename = firstGeofence.geofencename;
                        result.geofenceid = firstGeofence.geofenceid;
                        result.geofenceactiontype = firstGeofence.actiontype;
                        result.fleetid = firstGeofence.fleetid;
                    }
                }
                result.regno = regno;
            });
            flattenedData = flattenedData.filter((result) => result.rulename && result.rulename.length > 0).sort((a, b) => a.alerttime - b.alerttime);
            const response = this.reportSvcUtils.formatGeoAlertData(flattenedData);
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeoAlertRuleReport(accountId, userId, fleetId, ruleids, starttime, endtime) {
        const currtime = Date.now();

        // Validate time range
        if (starttime >= endtime || endtime > currtime || starttime < 0) {
            throw {
                errcode: 'INVALID_TIME_RANGE',
            };
        }

        try {
            // Get the time buckets for the given time range
            const timeBuckets = this.reportSvcUtils.clhTimeBucketRange(starttime, endtime);
            if (timeBuckets.length === 0) {
                throw {
                    errcode: 'NO_VALID_TIME_BUCKETS',
                };
            }

            const finalResults = [];

            const promises = timeBuckets.map((bucket) => {
                const query = `
                    SELECT 
                        ruleid,
                        vinno, 
                        alerttime, 
                        alerttype, 
                        alertid, 
                        odo, 
                        speed, 
                        soc, 
                        lat, 
                        lng, 
                        alertdata,
                        proctime
                    FROM lmmdata.geoalertdata_${bucket} 
                    WHERE ruleid IN (${ruleids.map((ruleid) => `'${ruleid}'`).join(',')})
                        AND alerttime >= ${starttime}
                        AND alerttime <= ${endtime}
                        AND lng != 0
                        AND lat != 0
                        AND accountid = '${accountId}'
                `;
                return this.chClientI.query(query);
            });
            const results = await Promise.all(promises);
            let flattenedData = results.flatMap((result) => result.data || []);
            const ruleDetailsMap = await this.getRuleDetailsMap(flattenedData.map((result) => result.ruleid));
            const vehDetailsMap = await this.getVehDetailsMap(flattenedData.map((result) => result.vinno));
            flattenedData.forEach((result) => {
                const ruleDetail = ruleDetailsMap.get(result.ruleid);
                const regno = vehDetailsMap.get(result.vinno);
                if (ruleDetail) {
                    result.rulename = ruleDetail.rulename;
                    const firstGeofence = ruleDetail.geofences[0];
                    if (firstGeofence) {
                        result.geofencename = firstGeofence.geofencename;
                        result.geofenceid = firstGeofence.geofenceid;
                        result.geofenceactiontype = firstGeofence.actiontype;
                        result.fleetid = firstGeofence.fleetid;
                    }
                }
                result.regno = regno;
            });
            flattenedData = flattenedData.filter((result) => result.rulename && result.rulename.length > 0).sort((a, b) => a.alerttime - b.alerttime);
            const response = this.reportSvcUtils.formatGeoAlertData(flattenedData);
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeoTripVehReport(accountId, userId, fleetId, vinnos, starttime, endtime) {
        const currtime = Date.now();

        // Validate time range
        if (starttime >= endtime || endtime > currtime || starttime < 0) {
            throw {
                errcode: 'INVALID_TIME_RANGE',
            };
        }

        try {
            // Get the time buckets for the given time range
            const timeBuckets = this.reportSvcUtils.clhTimeBucketRange(starttime, endtime);
            if (timeBuckets.length === 0) {
                throw {
                    errcode: 'NO_VALID_TIME_BUCKETS',
                };
            }

            const finalResults = [];

            const promises = timeBuckets.map((bucket) => {
                const query = `
                    SELECT
                        vinno,
                        ruleid,
                        tripstarttime,
                        tripendtime,
                        tripid,
                        startlat,
                        startlng,
                        endlat,
                        endlng,
                        startodo,
                        endodo,
                        startsoc,
                        endsoc,
                        proctime
                    FROM lmmdata.geotripdata_${bucket} 
                    WHERE vinno IN (${vinnos.map((vinno) => `'${vinno}'`).join(',')})
                        AND tripstarttime >= ${starttime}
                        AND tripstarttime <= ${endtime}
                        AND accountid = '${accountId}'
                `;
                return this.chClientI.query(query);
            });
            const results = await Promise.all(promises);
            let flattenedData = results.flatMap((result) => result.data || []);
            flattenedData = flattenedData.filter((result) => {
                if (result.tripendtime - result.tripstarttime > 43020000) {
                    return false;
                }
                return true;
            });
            const ruleDetailsMap = await this.getRuleDetailsMap(flattenedData.map((result) => result.ruleid));
            const vehDetailsMap = await this.getVehDetailsMap(flattenedData.map((result) => result.vinno));
            flattenedData.forEach((result) => {
                const ruleDetail = ruleDetailsMap.get(result.ruleid);
                const regno = vehDetailsMap.get(result.vinno);
                if (ruleDetail) {
                    result.rulename = ruleDetail.rulename;
                    const firstGeofence = ruleDetail.geofences[0];
                    if (firstGeofence) {
                        result.startgeofencename = firstGeofence.geofencename;
                        result.startgeofenceid = firstGeofence.geofenceid;
                        result.startgeofenceactiontype = firstGeofence.actiontype;
                        result.startgeofencefleetid = firstGeofence.fleetid;
                    }
                    const lastGeofence = ruleDetail.geofences[ruleDetail.geofences.length - 1];
                    if (lastGeofence) {
                        result.endgeofencename = lastGeofence.geofencename;
                        result.endgeofenceid = lastGeofence.geofenceid;
                        result.endgeofenceactiontype = lastGeofence.actiontype;
                        result.endgeofencefleetid = lastGeofence.fleetid;
                    }
                }
                result.regno = regno;
            });
            flattenedData = flattenedData.filter((result) => result.rulename && result.rulename.length > 0).sort((a, b) => a.tripstarttime - b.tripstarttime);
            const response = this.reportSvcUtils.formatGeoTripData(flattenedData);
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
            throw error;
        }
    }

    async getGeoTripRuleReport(accountId, userId, fleetId, ruleids, starttime, endtime) {
        const currtime = Date.now();

        // Validate time range
        if (starttime >= endtime || endtime > currtime || starttime < 0) {
            throw {
                errcode: 'INVALID_TIME_RANGE',
            };
        }

        try {
            // Get the time buckets for the given time range
            const timeBuckets = this.reportSvcUtils.clhTimeBucketRange(starttime, endtime);
            if (timeBuckets.length === 0) {
                throw {
                    errcode: 'NO_VALID_TIME_BUCKETS',
                };
            }

            const finalResults = [];

            const promises = timeBuckets.map((bucket) => {
                const query = `
                    SELECT 
                        vinno,
                        ruleid,
                        tripstarttime,
                        tripendtime,
                        tripid,
                        startlat,
                        startlng,
                        endlat,
                        endlng,
                        startodo,
                        endodo,
                        startsoc,
                        endsoc,
                        proctime
                    FROM lmmdata.geotripdata_${bucket} 
                    WHERE ruleid IN (${ruleids.map((ruleid) => `'${ruleid}'`).join(',')})
                        AND tripstarttime >= ${starttime}
                        AND tripstarttime <= ${endtime}
                        AND accountid = '${accountId}'
                `;
                return this.chClientI.query(query);
            });
            const results = await Promise.all(promises);
            let flattenedData = results.flatMap((result) => result.data || []);
            flattenedData = flattenedData.filter((result) => {
                if (result.tripendtime - result.tripstarttime > 43020000) {
                    return false;
                }
                return true;
            });
            const ruleDetailsMap = await this.getRuleDetailsMap(flattenedData.map((result) => result.ruleid));
            const vehDetailsMap = await this.getVehDetailsMap(flattenedData.map((result) => result.vinno));
            flattenedData.forEach((result) => {
                const ruleDetail = ruleDetailsMap.get(result.ruleid);
                const regno = vehDetailsMap.get(result.vinno);
                if (ruleDetail) {
                    result.rulename = ruleDetail.rulename;
                    const firstGeofence = ruleDetail.geofences[0];
                    if (firstGeofence) {
                        result.startgeofencename = firstGeofence.geofencename;
                        result.startgeofenceid = firstGeofence.geofenceid;
                        result.startgeofenceactiontype = firstGeofence.actiontype;
                        result.startgeofencefleetid = firstGeofence.fleetid;
                    }
                    const lastGeofence = ruleDetail.geofences[ruleDetail.geofences.length - 1];
                    if (lastGeofence) {
                        result.endgeofencename = lastGeofence.geofencename;
                        result.endgeofenceid = lastGeofence.geofenceid;
                        result.endgeofenceactiontype = lastGeofence.actiontype;
                        result.endgeofencefleetid = lastGeofence.fleetid;
                    }
                }
                result.regno = regno;
            });
            flattenedData = flattenedData.filter((result) => result.rulename && result.rulename.length > 0).sort((a, b) => a.tripstarttime - b.tripstarttime);
            const response = this.reportSvcUtils.formatGeoTripData(flattenedData);
            return response;
        } catch (error) {
            error instanceof Error && this.logger.error(error.toString());
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

    async getRuleDetailsMap(ruleids = []) {
        const ruleDetailQuery = `SELECT r.ruleid,
                                            r.rulename,
                                            g.geofenceid,
                                            g.fleetid,
                                            g.geofencename,
                                            gi.actiontypeid,
                                            rga.actiontype,
                                            gi.seqno
                                    FROM geofencerule r
                                    INNER JOIN geofenceruleinfo gi ON r.ruleid = gi.ruleid
                                    INNER JOIN geofence g ON gi.geofenceid = g.geofenceid
                                    INNER JOIN rulegeofenceaction rga ON gi.actiontypeid = rga.actiontypeid
                                    WHERE r.ruleid = ANY($1::uuid[])
                                    ORDER BY r.ruleid, gi.seqno`;
        const ruleDetails = await this.pgPoolI.Query(ruleDetailQuery, [ruleids]);

        // Group by ruleid to handle multiple geofences per rule
        // Each rule can have multiple geofences with different sequence numbers
        const ruleDetailsMap = new Map();
        ruleDetails.rows.forEach((row) => {
            if (!ruleDetailsMap.has(row.ruleid)) {
                ruleDetailsMap.set(row.ruleid, {
                    ruleid: row.ruleid,
                    rulename: row.rulename,
                    geofences: [],
                });
            }
            ruleDetailsMap.get(row.ruleid).geofences.push({
                geofenceid: row.geofenceid,
                geofencename: row.geofencename,
                fleetid: row.fleetid,
                actiontypeid: row.actiontypeid,
                actiontype: row.actiontype,
                seqno: row.seqno,
            });
            ruleDetailsMap.get(row.ruleid).geofences.sort((a, b) => a.seqno - b.seqno);
        });

        return ruleDetailsMap;
    }

    async getVehDetailsMap(vinnos = []) {
        const vehDetailsQuery = `SELECT vinno, license_plate FROM ${this.config.schemas.fmscoresch}.vehicle WHERE vinno = ANY($1::text[])`;
        const vehDetails = await this.pgPoolI.Query(vehDetailsQuery, [vinnos]);
        const vehDetailsMap = new Map();
        vehDetails.rows.forEach((row) => {
            vehDetailsMap.set(row.vinno, row.license_plate || row.vinno);
        });
        return vehDetailsMap;
    }
}
