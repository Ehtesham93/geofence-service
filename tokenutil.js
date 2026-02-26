// Express middleware to extract JWT from cookie header and attach claims to req
import { GetUnVerifiedClaims } from './jwtutil.js';
import { APIResponseUnauthorized } from './responseutil.js';

export const AuthenticateAccountTokenFromCookie = (req, res, next) => { //taking auth token from cokkies and call next 
    try {
        // set cookies in header and check http headers lowercase / headercase 
        // cookies header is coming in string 
        const cookie = req.headers['Cookie'] || req.headers['cookie']; 
        let token = req.headers['Cookie'] || req.headers['cookie']; 

        //checking is not token then api response unathorized and res req that token is required.
        if (!token) {
            APIResponseUnauthorized(req, res, 'TOKEN_REQUIRED', 'Token is required', 'Token is required');
            return;
        }

        // handle multiple cookies
        if (token.includes(';')) { //  if token include ; 
            const cookies = token.split(';'); // ; then it is handle multiple cookies its does spilt 
            for (let eachcookie of cookies) {
                eachcookie = eachcookie.trim(); // its remove the spaces from cokkies
                if (eachcookie.startsWith('token=')) { // only need cookies which startwith token
                    token = eachcookie.substring(6);  // token length  = 6 substring
                    break; // if token found then loop stop
                }
            }
        }

        if (token.startsWith('token=')) {
            token = token.substring(6);
        }

        const claims = GetUnVerifiedClaims(token); // decode jwt tocken and if decode fail then invalid token -> unaauthorized
        if (!claims) {
            APIResponseUnauthorized(req, res, 'INVALID_TOKEN', 'Invalid token', 'Invalid token');
            return;
        }

        // userid / accountid mandatory checking  

        if (!claims.userid) {
            APIResponseUnauthorized(req, res, 'INVALID_TOKEN', 'User ID is missing in token', 'User ID is missing in token');
            return;
        }

        if (!claims.accountid) {
            APIResponseUnauthorized(req, res, 'INVALID_TOKEN', 'Account ID is missing in token', 'Account ID is missing in token');
            return;
        }

        // token verify by auth middleware and attach user identify because api directly use (db query , permission check)

        req.cookie = cookie;
        req.token = token;
        req.userid = claims.userid;
        req.accountid = claims.accountid;

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');

        next();
    } catch (error) {
        APIResponseUnauthorized(req, res, 'INVALID_TOKEN', 'Account token validation failed', 'Account token validation failed');
    }
};
