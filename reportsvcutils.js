import * as wrappers from '../../utils/wrappers.js';
import { convertEpochToIST } from '../../utils/utils.js';
export default class ReportSvcUtils {
    clhTimeBucketRange(starttime, endtime) {
        // Calculate minbucket and maxbucket
        const daysInMillis = 30 * 86400000; // 30 days in milliseconds
        const minbucket = Math.floor(starttime / daysInMillis);
        const maxbucket = Math.floor(endtime / daysInMillis);

        const count = maxbucket - minbucket + 1;
        if (count <= 0) {
            return []; // Return an empty array if the count is 0 or less
        }

        const utctimeb = [];
        for (let i = 0; i < count; i++) {
            utctimeb.push(minbucket + i);
        }

        return utctimeb;
    }

    formatGeoAlertData(data) {
        return data.map((item) => {
            return {
                vinno: item.vinno,
                regno: item.regno,
                alerttime: convertEpochToIST(Number(item.alerttime)),
                alerttimeepoch: Number(item.alerttime),
                alerttype: item.alerttype,
                alertid: item.alertid,
                // odo: item.odo,
                // speed: Number(item.speed),
                soc: Number(item.soc),
                lat: Number(item.lat),
                lng: Number(item.lng),
                rulename: item.rulename || "",
                geofencename: item.geofencename || "",
                geofenceid: item.geofenceid || null,
                fleetid: item.fleetid,
                geofenceactiontype: item.geofenceactiontype || "",
                // alertdata: item.alertdata,
                proctime: convertEpochToIST(Number(item.proctime)),
            };
        });
    }

    formatGeoTripData(data) {
        return data.map((item) => {
            return {
                vinno: item.vinno,
                regno: item.regno,
                tripstarttime: convertEpochToIST(Number(item.tripstarttime)),
                tripstarttimeepoch: Number(item.tripstarttime),
                tripendtime: convertEpochToIST(Number(item.tripendtime)),
                tripendtimeepoch: Number(item.tripendtime),
                tripid: item.tripid,
                startlat: Number(item.startlat),
                startlng: Number(item.startlng),
                endlat: Number(item.endlat),
                endlng: Number(item.endlng),
                rulename: item.rulename || "",
                startgeofencename: item.startgeofencename || "",
                startgeofenceid: item.startgeofenceid || null,
                startgeofencefleetid: item.startgeofencefleetid,
                startgeofenceactiontype: item.startgeofenceactiontype || "",
                endgeofencename: item.endgeofencename || "",
                endgeofenceid: item.endgeofenceid || null,
                endgeofencefleetid: item.endgeofencefleetid,
                endgeofenceactiontype: item.endgeofenceactiontype || "",
                startodo: Number(item.startodo),
                endodo: Number(item.endodo),
                startsoc: Number(item.startsoc),
                endsoc: Number(item.endsoc),
                proctime: convertEpochToIST(Number(item.proctime)),
            };
        });
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
