-- geofencesch_drop_tables.sql
BEGIN;

-- Use the geofencesch schema for this session
SET search_path TO geofencesch;

-- Drop all geofence-related tables
DROP TABLE IF EXISTS
    geofencerulefleet,
    geofenceruleinfo,
    geofencerule,
    geofenceruletype,
    geofenceruleuser,
    geofencerulevehalert,
    geofencerulevehicle,
    geofencerulevehtrip,
    geofence,
    geofencevehrulealert,
    geofencevehruletrip,
    rulegeofenceaction
CASCADE;

COMMIT;
