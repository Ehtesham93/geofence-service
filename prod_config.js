// Production environment configuration
export default {
    pgdb: {
        host: "nemo-rds-cluster.cluster-crxro9saq2rc.ap-south-1.rds.amazonaws.com",
        port: 5432,
        database: "lmm_intellicar_nemo3",
        schema: "geofencesch",
        user: "lmmintellicar_admin",
        password: "wCUxbhkhYQt70RJ9",
      },
    schemas: {
        fmscoresch: 'prodfmscoresch',
    },
    apiserver: {
        port: 10004,
    },
    geofenceFeature: {
        getSubscribedVinsOnly: false
    },
    logToConsole: false,
    externalApiUrl: 'http://prod-nemo3-api-fms-svc.intellicar:10004',
    clickhouse: {
        urls: [
            "http://10.100.19.54:8123",
            "http://10.100.19.220:8123",
            "http://10.100.19.103:8123",
            "http://10.100.19.121:8123",
            "http://10.100.19.61:8123"
        ],
        username: 'default',
        password: 'lmm@nemo',
        database: 'lmmdata',
        maxBatchDataSize: 25000,
        maxParallelRequests: 100000,
    },
};
