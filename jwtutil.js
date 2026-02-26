import jwt from 'jsonwebtoken';

export function GetUnVerifiedClaims(token) {
    return jwt.decode(token, {
        json: true,
    });
}
