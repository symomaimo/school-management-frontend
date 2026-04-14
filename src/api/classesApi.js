import api from "./Axios";

export const listClassFees = (params = {}) =>
  api.get("/classes", { params }).then((r) => r.data);

export const bulkUpsertClassFees = (items) =>
  api.post("/classes/bulk", { items }).then((r) => r.data);

export const upsertClassFee = (payload) =>
  api.post("/classes", payload).then((r) => r.data);
