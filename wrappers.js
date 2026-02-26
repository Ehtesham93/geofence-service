import axios from 'axios';
import config from '../config/config.js';

export async function externalApiCall(path, body, method = 'GET', cookie) {
    try {
        let referer = '';
        if (process.env.APP_ENV === 'STAGING') {
            referer = 'https://stg-nemo.mahindralastmilemobility.com:2053/fms';
        } else {
            referer = 'https://stg-nemo.mahindralastmilemobility.com:2083/fms';
        }
        const headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
            Accept: 'application/json',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            Connection: 'keep-alive',
            Referer: referer,
            Cookie: cookie,
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            TE: 'trailers',
        };

        const response = await axios({
            url: `${config.externalApiUrl}${path}`,
            method: method,
            data: body,
            headers: headers,
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        console.log('=== External API Call Error ===');
        console.log('Error message:', error.message);
        console.log('=== End Error Details ===');

        if (error.response && error.response.status === 401) {
            throw new Error(`Authentication failed: ${error.response.data?.exp || 'No credentials found'}`);
        }

        throw new Error(error.response.data?.msg || `Failed to connect, Try again later`);
    }
}
