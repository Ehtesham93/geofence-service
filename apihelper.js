import axios from "axios";

async function doPost(url, header, data) {
  try {
    const response = await axios.post(url, data, {
      headers: header,
    });
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    const errorResponse = {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message,
      headers: error.response?.headers,
    };

    console.error("POST request failed:", {
      url,
      status: errorResponse.status,
      error: errorResponse.error,
    });

    return errorResponse;
  }
}

async function doPut(url, header, data) {
  try {
    const response = await axios.put(url, data, {
      headers: header,
    });
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    const errorResponse = {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message,
      headers: error.response?.headers,
    };

    console.error("PUT request failed:", {
      url,
      status: errorResponse.status,
      error: errorResponse.error,
    });

    return errorResponse;
  }
}

async function doGet(url, headers) {
  try {
    const response = await axios.get(url, {
      headers: headers,
    });
    return {
      success: true,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    const errorResponse = {
      success: false,
      status: error.response?.status,
      error: error.response?.data || error.message,
      headers: error.response?.headers,
    };

    console.error("GET request failed:", {
      url,
      status: errorResponse.status,
      error: errorResponse.error,
    });

    return errorResponse;
  }
}

export { doPut, doPost, doGet };
