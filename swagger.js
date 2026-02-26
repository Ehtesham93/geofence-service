import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const swaggerSpec = yaml.load(
  readFileSync(join(__dirname, "./swagger.yaml"), "utf8")
);

export const swaggerDocs = (app) => {
  const swaggerUiOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  app.use(
    "/api/v1/fms/geofence/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );
  //http://localhost:10008/api/v1/fms/geofence/api-docs/

  app.get("/api/v1/fms/geofence/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
};
