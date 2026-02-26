// Staging environment configuration
export default {
    pgdb: {
        host: 'lmm.stgdb.nemo3',
        port: 5432,
        database: 'lmmintellicar',
        schema: 'geofencesch',
        user: 'lmmintellicar_admin',
        password: 'Z52DWfsAZIBtnOK',
    },
    schemas: {
        fmscoresch: 'stgfmscoresch',
    },
    apiserver: {
        port: 10004,
    },
    geofenceFeature: {
        getSubscribedVinsOnly: false
    },
    logToConsole: false,
    externalApiUrl: 'http://stg-nemo3-api-fms-svc.intellicar-frontend1:10004',
    clickhouse: {
        urls: [
          "http://10.178.0.242:8123",
          "http://10.178.0.16:8123",
          "http://10.178.0.210:8123",
          "http://10.178.0.45:8123",
          "http://10.178.0.132:8123",
        ],
        username: "default",
        password: "",
        database: "lmmdata",
        maxBatchDataSize: 25000,
        maxParallelRequests: 100000,
        compression: {
          response: true,
          request: true,
        },
        keep_alive: {
          enabled: true,
        },
      }
};
