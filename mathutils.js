export function formatDistanceToStr(distance) {
    return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(2)}km`;
}

export function haversineDistance({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 }) {
    if (!lat1 || !lat2 || !lon1 || !lon2) {
        return 0;
    }
    const R = 3958.8;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
    const distance = 2 * R * Math.asin(Math.sqrt(a));
    return distance * 1.5;
}

export function validateLatLng(lat, lng) {
    if (lat === null || lng === null || lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return false;
    }
    return true;
}

export function parseAndRound(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return null;
    }
    return Math.round(parseFloat(value));
}

export function formatMobileNumber(mobileNumber) {
    if (mobileNumber != null) {
        mobileNumber = String(mobileNumber).slice(1, 11);
        return mobileNumber;
    }
    return mobileNumber;
}
