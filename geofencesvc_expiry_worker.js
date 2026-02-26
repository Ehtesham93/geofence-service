// geofencesvc_expiry_worker.js

export default class GeofenceExpiryWorker {
    // instance of geofenceSvcDB and structure logger
    constructor(geofenceSvcDB, logger) {
        this.geofenceSvcDB = geofenceSvcDB;
        this.logger = logger;

        this._timer = null;
        this._running = false;

        // keep last effective interval for fallback
        this._fallbackIntervalMs = 5 * 60 * 1000;
    }

    // Run once
    async runOnce() {
        if (this._running) return { skipped: true };
        this._running = true;

        try {
            const result = await this.geofenceSvcDB.deactivateExpiredRules();
            const updated = result?.rowCount ?? 0;

            if (updated > 0) {
                this.logger.info?.({ updated }, 'GeofenceExpiryWorker: deactivated expired rules');
            } else {
                this.logger.debug?.({ updated }, 'GeofenceExpiryWorker: no expired active rules found');
            }

            return { updated };
        } catch (err) {
            this.logger.error?.(
                { err: err?.toString?.() ?? err },
                'GeofenceExpiryWorker: runOnce failed'
            );

            // dont crash service; just report failure
            return { updated: 0, error: true };
        } finally {
            this._running = false;

            // schedule next run after every tick (even on error)
            this._scheduleNext().catch((e) => {
                this.logger.error?.(
                    { err: e?.toString?.() ?? e },
                    'GeofenceExpiryWorker: scheduleNext failed'
                );
            });
        }
    }

    async _scheduleNext() {
        // clear old timer
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        // IMPORTANT: your pool uses Query(), not query()
        const q = `
            SELECT MIN(expiry_at) AS next_expiry
            FROM geofencesch.geofencerule
            WHERE isactive = true
              AND isdeleted = false
              AND expiry_at IS NOT NULL
        `;

        let delayMs = this._fallbackIntervalMs;

        try {
            const res = await this.geofenceSvcDB.pgPoolI.Query(q, []);
            const next = res?.rows?.[0]?.next_expiry;

            if (next) {
                // exact delay till nearest expiry (0+)
                delayMs = Math.max(new Date(next).getTime() - Date.now(), 0);
            }
        } catch (e) {
            // fallback to interval if query fails
            this.logger.error?.(
                { err: e?.toString?.() ?? e },
                'GeofenceExpiryWorker: next expiry fetch failed, using fallback interval'
            );
        }

        this.logger.debug?.({ delayMs }, 'GeofenceExpiryWorker: next run scheduled');

        this._timer = setTimeout(() => {
            this.runOnce();
        }, delayMs);

        // allow process to exit naturally if nothing else is pending
        this._timer.unref?.();
    }

    // start interval server (kept same signature)
    start({ intervalMs } = {}) {
        // ENV override (highest priority)
        const envMsRaw = process.env.GEOFENCE_EXPIRY_WORKER_INTERVAL_MS;
        const envMs = envMsRaw ? Number(envMsRaw) : NaN;

        const effectiveIntervalMs =
            Number.isFinite(envMs) && envMs > 0
                ? envMs
                : (Number.isFinite(Number(intervalMs)) && Number(intervalMs) > 0
                    ? Number(intervalMs)
                    : 5 * 60 * 1000);

        // store as fallback (only used when no expiry found / query fails)
        this._fallbackIntervalMs = effectiveIntervalMs;

        this.logger.info?.(
            'GeofenceExpiryWorker: started'
        );

        // run immediately once (this will schedule next automatically)
        this.runOnce();
    }

    stop() {
        if (!this._timer) return;
        clearTimeout(this._timer);
        this._timer = null;
        this.logger.info?.('GeofenceExpiryWorker: stopped');
    }
}