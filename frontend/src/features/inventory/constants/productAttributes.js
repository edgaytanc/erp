export const SKIN_TYPES = [
  { value: "GRASA", label: "Piel Grasa" },
  { value: "SECA", label: "Piel Seca" },
  { value: "MIXTA", label: "Piel Mixta" },
  { value: "SENS", label: "Piel Sensible" },
  { value: "NORM", label: "Piel Normal" },
  { value: "TODO", label: "Todo Tipo de Piel" },
  { value: "CAB_GRASO", label: "Cabello Graso" },
  { value: "CAB_SECO", label: "Cabello Seco" },
];

export const TARGET_PROBLEMS = [
  { value: "ACNE", label: "Acné" },
  { value: "MANCHAS", label: "Manchas" },
  { value: "ARRUGAS", label: "Arrugas" },
  { value: "CAIDA", label: "Caída de Cabello" },
  { value: "CASPA", label: "Caspa" },
  { value: "ROJEZ", label: "Rojez / Irritación" },
  { value: "DOLOR", label: "Dolor Muscular / Articular" },
];

export const PRODUCT_BENEFITS = [
  { value: "HIDRAT", label: "Hidratación" },
  { value: "SEBOCONT", label: "Control de Sebo / Matificante" },
  { value: "ANTIAGE", label: "Anti-edad / Firmeza" },
  { value: "DESPIGM", label: "Despigmentante / Aclarador" },
  { value: "CALMANTE", label: "Calmante / Reparador" },
  { value: "PROTSOL", label: "Protección Solar" },
  { value: "ESTIMCAP", label: "Estimulación Capilar" },
];

export const SKIN_TYPE_MAP = Object.fromEntries(
  SKIN_TYPES.map((item) => [item.value, item.label]),
);

export const TARGET_PROBLEM_MAP = Object.fromEntries(
  TARGET_PROBLEMS.map((item) => [item.value, item.label]),
);

export const PRODUCT_BENEFIT_MAP = Object.fromEntries(
  PRODUCT_BENEFITS.map((item) => [item.value, item.label]),
);
