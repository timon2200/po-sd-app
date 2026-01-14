import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

export const fetchTransactions = async (startDate, endDate, type, page = 1, limit = 50, search = '') => {
    let query = '';
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (type) params.push(`type=${type}`);
    if (page) params.push(`page=${page}`);
    if (limit) params.push(`limit=${limit}`);
    if (search) params.push(`search=${encodeURIComponent(search)}`);

    console.log("API fetchTransactions called with:", { startDate, endDate, type, page, limit, search });
    if (params.length > 0) {
        query = '?' + params.join('&');
    }

    console.log("Fetching URL:", `transactions${query}`);
    const response = await api.get(`transactions${query}`);
    return response.data; // Now returns { data: [...], total: 100, ... }
};

export const syncLocalFile = async (filePath) => {
    const response = await api.post(`/transactions/sync-local?file_path=${encodeURIComponent(filePath)}`);
    return response.data;
};

export const uploadTransactions = async (formData) => {
    const response = await api.post('/transactions/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const syncGmail = async (query) => {
    let url = '/sync/gmail';
    if (query) {
        url += `?query=${encodeURIComponent(query)}`;
    }
    const response = await api.post(url);
    return response.data;
};

export const checkAuth = async () => {
    const response = await api.post('/auth/google');
    return response.data;
};

export const getSettings = async () => {
    const response = await api.get('/settings');
    return response.data;
};

export const getStats = async (year) => {
    const response = await api.get(`/posd-stats?year=${year}`);
    return response.data;
};

export const getMemorandumPdf = async (year) => {
    const response = await api.get(`/posd/memorandum?year=${year}&t=${Date.now()}`, {
        responseType: 'blob'
    });
    return response.data;
};

export const mergeDocuments = async (filenames) => {
    const response = await api.post('/documents/merge', { filenames }, {
        responseType: 'blob'
    });
    return response.data;
};

export const getProfile = async () => {
    const response = await api.get('/auth/me');
    return response.data;
};

export const logout = async () => {
    const response = await api.post('/auth/logout');
    return response.data;
};

export const generateXml = async (posdData) => {
    // Send POST request, expect file blob
    const response = await api.post('/posd/xml', posdData, {
        responseType: 'blob'
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PO-SD_${posdData.year}.xml`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

export const generatePaymentCode = async (data) => {
    const response = await api.post('/utils/generate-payment-code', data);
    return response.data; // { qr_code: "data:image/png;base64,..." }
};

export const generateInvoicePdf = async (htmlContent, filename) => {
    const response = await api.post('/documents/html-to-pdf', { html_content: htmlContent, filename }, {
        responseType: 'blob'
    });
    return response.data;
};

export default api;

// --- Client & Sudreg API ---

export const getClients = async () => {
    const response = await api.get('/clients');
    return response.data;
};

export const saveClient = async (clientData) => {
    const response = await api.post('/clients', clientData);
    return response.data;
};

export const deleteClient = async (clientId) => {
    const response = await api.delete(`/clients/${clientId}`);
    return response.data;
};

export const searchSudreg = async (name) => {
    const response = await api.get(`/sudreg/search?name=${encodeURIComponent(name)}`);
    return response.data;
};


export const getSudregDetails = async (oib) => {
    const response = await api.get(`/sudreg/details?oib=${encodeURIComponent(oib)}`);
    return response.data;
};

// --- Invoice Management ---

export const fetchInvoices = async (page = 1, limit = 50, search = '', status = '') => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', limit);
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await api.get(`/invoices?${params.toString()}`);
    return response.data;
};

export const createInvoice = async (invoiceData) => {
    const response = await api.post('/invoices', invoiceData);
    return response.data;
};

export const getInvoiceStats = async (year) => {
    const response = await api.get(`/invoices/stats?year=${year}`);
    return response.data;
};

export const deleteInvoice = async (id) => {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
};

export const downloadInvoicePdf = async (id) => {
    const response = await api.get(`/invoices/${id}/pdf`, {
        responseType: 'blob'
    });
    return response.data;
};

