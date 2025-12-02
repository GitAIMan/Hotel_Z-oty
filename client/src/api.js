import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

export const confirmSettlement = (data) => api.post('/settlements/confirm', data);
export const linkInvoiceToTransaction = (invoiceId, data) => api.post(`/invoices/${invoiceId}/link-transaction`, data);
export const unlinkInvoiceFromTransaction = (invoiceId) => api.post(`/invoices/${invoiceId}/unlink-transaction`);
export const unlinkAllFromSettlement = (settlementId) => api.post(`/settlements/${settlementId}/unlink-all`);
export const getSettlements = (entity) => api.get(`/settlements?entity=${entity}`).then(res => res.data);

export default api;
