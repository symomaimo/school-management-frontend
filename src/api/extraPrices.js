import api from "./Axios";

// list with optional query filters
export const listExtraPrices = (params = {}) =>
  api.get("/extraprices", { params }).then((r) => r.data.data);

// upsert single
export const upsertExtraPrice = (payload) =>
  api.post("/extraprices", payload).then((r) => r.data.data);

// bulk upsert
export const bulkUpsertExtraPrices = (items) =>
  api.post("/extraprices/bulk", { items }).then((r) => r.data);

// wipe all (admin)
export const wipeAllExtraPrices = () =>
  api.delete("/extraprices/admin/all", { params: { confirm: "WIPE_ALL" } })
    .then((r) => r.data);
