//config.js
// Environment-aware config selector. Loads per-env settings and validates schema.
import stagingConfig from './stg_config.js';
import developmentConfig from './dev_config.js';
import localConfig from './local_config.js';
import productionConfig from './prod_config.js';
let config = {};

// NOTE: console logs here help verify runtime environment during startup

console.log('APP_ENV: ', process.env.APP_ENV);

if (process.env.APP_ENV === 'PRODUCTION') {
    console.log('Using production config');
    config = productionConfig;
} else if (process.env.APP_ENV === 'STAGING') {
    console.log('Using staging config');
    config = stagingConfig;
} else if (process.env.APP_ENV === 'DEVELOPMENT') {
    console.log('Using development config');
    config = developmentConfig;
} else {
    console.log('Using local config');
    config = localConfig;
}

const ALLOWED_SCHEMAS = ['devfmscoresch', 'stgfmscoresch', 'geofencesch', 'prodfmscoresch'];

// Validate configured schema to avoid accidental cross-env writes/reads
function validateSchema(schemaName) {
  if (!ALLOWED_SCHEMAS.includes(schemaName)) {
    throw new Error(`Invalid or unsupported schema: ${schemaName}`);
  }
  return schemaName;
}

validateSchema(config.schemas.fmscoresch);

export default config;
