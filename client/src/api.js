import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

export const confirmSettlement = (data) => api.post('/settlements/confirm', data);
export const linkInvoiceToTransaction = (invoiceId, data) => api.post(`/invoices/${invoiceId}/link-transaction`, data);

export default api;
