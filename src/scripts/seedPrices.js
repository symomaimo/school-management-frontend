const mongoose = require("mongoose");
const ExtraPrice = require("../models/extraprice/ExtraPrice");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/school_system";

// IMPORTANT: if your backend expects another key for tuition, change here:
const CLASS_FEE_KEY = "TUITION";

const YEAR = 2026;
const TERMS = ["Term1", "Term2", "Term3"];

const CLASSES = [
  "Playgroup","PP1","PP2",
  "Grade 1","Grade 2","Grade 3","Grade 4","Grade 5",
  "Grade 6","Grade 7","Grade 8","Grade 9"
];

const gradeNum = (cls) => {
  const m = String(cls).match(/grade\s*([1-9])/i);
  return m ? Number(m[1]) : null;
};

// ===== YOUR FINAL AMOUNTS =====
function tuitionAmount(cls) {
  if (["Playgroup", "PP1", "PP2"].includes(cls)) return 2000;
  if (["Grade 1", "Grade 2", "Grade 3"].includes(cls)) return 3500;
  if (["Grade 4", "Grade 5", "Grade 6"].includes(cls)) return 4200;
  if (["Grade 7", "Grade 8", "Grade 9"].includes(cls)) return 7000;
  return null;
}

function admissionAmount(cls) {
  const g = gradeNum(cls);
  if (["Playgroup", "PP1", "PP2"].includes(cls)) return 300;
  if (g != null && g >= 1 && g <= 6) return 300;
  if (g != null && g >= 7 && g <= 9) return 500;
  return null;
}

function assessmentAmount(cls) {
  const g = gradeNum(cls);
  if (["Playgroup", "PP1", "PP2"].includes(cls)) return 400;
  if (g != null && g >= 1 && g <= 6) return 350;
  return null; // Grade 7–9 blocked by Extras.js
}

async function upsertPrice({ key, amount, classLabel, year, term, isActive = true }) {
  await ExtraPrice.updateOne(
    { key, classLabel, year, term },
    { $set: { key, amount, classLabel, year, term, isActive } },
    { upsert: true }
  );
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected:", MONGO_URI);

  // 1) Tuition (class fee) for all classes & all terms
  for (const term of TERMS) {
    for (const cls of CLASSES) {
      const amt = tuitionAmount(cls);
      if (amt == null) continue;
      await upsertPrice({ key: CLASS_FEE_KEY, amount: amt, classLabel: cls, year: YEAR, term });
    }
  }

  // 2) Admission fee (per class, term=null)
  for (const cls of CLASSES) {
    const amt = admissionAmount(cls);
    if (amt == null) continue;
    await upsertPrice({ key: "ADMISSION_FEE", amount: amt, classLabel: cls, year: YEAR, term: null });
  }

  // 3) Assessment books (per class, term=null)
  for (const cls of CLASSES) {
    const amt = assessmentAmount(cls);
    if (amt == null) continue;
    await upsertPrice({ key: "ASSESSMENT_BOOK", amount: amt, classLabel: cls, year: YEAR, term: null });
  }

  // 4) Tracksuit = 0
  await upsertPrice({ key: "TRACKSUIT_ONBOARD", amount: 0, classLabel: "ALL", year: YEAR, term: null });
  await upsertPrice({ key: "TRACKSUIT_ENTER_G7", amount: 0, classLabel: "Grade 7", year: YEAR, term: null });

  // 5) Lockers = 3000 (term=null)
  await upsertPrice({ key: "LOCKER_G7_9", amount: 3000, classLabel: "ALL", year: YEAR, term: null });

  // 6) Reams = 650 (Term2 only)
  await upsertPrice({ key: "REAMS_G7_9_T2", amount: 650, classLabel: "ALL", year: YEAR, term: "Term2" });

  // 7) Graduation fee PP2 = 650 (Term3 only)
  await upsertPrice({ key: "GRAD_PP2_T3", amount: 650, classLabel: "PP2", year: YEAR, term: "Term3" });

  // 8) Textbooks
  // New Grade 4–8 = 5000 (admission term; term=null)
  for (const cls of ["Grade 4","Grade 5","Grade 6","Grade 7","Grade 8"]) {
    await upsertPrice({ key: "TEXTBOOKS_5000_G4_8_NEW", amount: 5000, classLabel: cls, year: YEAR, term: null });
  }

  // New Grade 2–3 = 2500 (admission term; term=null)
  for (const cls of ["Grade 2","Grade 3"]) {
    await upsertPrice({ key: "TEXTBOOKS_2500_G2_3_NEW", amount: 2500, classLabel: cls, year: YEAR, term: null });
  }

  // Whole-year (charge once/year via PER_YEAR logic)
  await upsertPrice({ key: "TEXTBOOKS_2500_G1_ALL", amount: 2500, classLabel: "Grade 1", year: YEAR, term: null });
  await upsertPrice({ key: "TEXTBOOKS_2500_G9_ALL", amount: 2500, classLabel: "Grade 9", year: YEAR, term: null });
  await upsertPrice({ key: "TEXTBOOKS_2500_G4_EXISTING", amount: 2500, classLabel: "Grade 4", year: YEAR, term: null });

  console.log("✅ Seed complete for", YEAR);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});