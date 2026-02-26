// Local development configuration (developer machine/testing)
export default {
  pgdb: {
        host: 'localhost',
        port: 5432,
        database: 'lmmintellicar',
        schema: 'geofencesch',
        user: 'postgres',
        password: 'Classic@73093',
    },
    schemas: {
        fmscoresch: 'devfmscoresch',
    },
    apiserver: {
        port: 10069,
    },
    geofenceFeature: {
        getSubscribedVinsOnly: false
    },
    logToConsole: true,
    externalApiUrl: 'http://localhost:10004',
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
