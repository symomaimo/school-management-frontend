export const TERMS = ["Term1", "Term2", "Term3"];

export const asNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ✅ UPDATED: include variant in the ID (needed for TRANSPORT routes TIPIS/MAU/GATIMU)
// Backwards compatible: old IDs without variant still parse correctly.
export const priceId = ({
  key,
  variant = null,          // ✅ NEW
  classLabel = "ALL",
  year = null,
  term = null,
}) => {
  const v = variant == null ? "null" : String(variant).toUpperCase().trim();
  return `${key}|${v}|${classLabel}|${year ?? "null"}|${term ?? "null"}`;
};

export const parsePriceId = (id) => {
  const parts = String(id).split("|");

  // ✅ Old format (no variant): key|classLabel|year|term
  if (parts.length === 4) {
    const [key, classLabel, y, t] = parts;
    return {
      key,
      variant: null,
      classLabel,
      year: y === "null" ? null : Number(y),
      term: t === "null" ? null : t,
    };
  }

  // ✅ New format: key|variant|classLabel|year|term
  const [key, v, classLabel, y, t] = parts;
  return {
    key,
    variant: v === "null" ? null : v,
    classLabel,
    year: y === "null" ? null : Number(y),
    term: t === "null" ? null : t,
  };
};

// If you use isGlobalKey to decide if something is term/year sensitive,
// transport is still "global by default" unless you decide otherwise.
// No change required unless you want special behavior.
export const isGlobalKey = (key) =>
  /^TEXTBOOKS_STAGE_/.test(key) ||
  [
    "REAMS_G7_9_T2",
    "GRAD_PP2_T3",
    "LOCKER_G7_9",
    "ADMISSION_FEE",
    "TRACKSUIT_ONBOARD",
    "TRACKSUIT_ENTER_G7",
  ].includes(key);
