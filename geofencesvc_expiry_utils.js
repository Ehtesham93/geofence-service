export function computeExpireyAt(expiryDuration){
    if (!expiryDuration) return null;

    const now = new Date();

    switch (expiryDuration){
        case '1_day':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);

        case '1_week':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        case '1_month':{
            const d = new Date(now);
            d.setMonth(d.getMonth() + 1);
            return d;
        }

        default:{
            const err = new Error(`Invalid expiryDuration: ${expiryDuration}`);
            err.errcode = 'INVALID_EXPIRY_DURATION';
            throw err;
        }
    }
}