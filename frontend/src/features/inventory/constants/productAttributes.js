export const SKIN_TYPES = [
  { value: "GRASA", label: "Piel Grasa" },
  { value: "SECA", label: "Piel Seca" },
  { value: "MIXTA", label: "Piel Mixta" },
  { value: "SENS", label: "Piel Sensible" },
  { value: "NORM", label: "Piel Normal" },
  { value: "CAB_GRASO", label: "Cabello Graso" },
  { value: "CAB_SECO", label: "Cabello Seco" },
  { value: "CONSUMO", label: "Consumo Humano (Abarrotes/Bebidas)" },
  { value: "ROPA", label: "Cuidado de la Ropa" },
  { value: "SUPERFICIES", label: "Limpieza de Superficies" },
  { value: "SALUD", label: "Salud General" },
  { value: "TODO", label: "Todo Uso" },
];

export const TARGET_PROBLEMS = [
  { value: "ACNE", label: "Acné" },
  { value: "MANCHAS", label: "Manchas en la Piel" },
  { value: "ARRUGAS", label: "Arrugas / Líneas de expresión" },
  { value: "CAIDA", label: "Caída de Cabello" },
  { value: "CASPA", label: "Caspa" },
  { value: "ROJEZ", label: "Rojez / Irritación" },
  { value: "DOLOR", label: "Dolor / Malestar General" },
  { value: "SUCIEDAD", label: "Suciedad / Grasa Doméstica" },
  { value: "MANCHAS_ROPA", label: "Manchas en Ropa" },
  { value: "MAL_OLOR", label: "Mal Olor" },
  { value: "SED", label: "Sed / Deshidratación" },
  { value: "HAMBRE", label: "Hambre / Antojo" },
  { value: "FALTA_ENERGIA", label: "Falta de Energía / Deficiencia" },
  { value: "NINGUNO", label: "Recreación / Ocio" },
];

export const PRODUCT_BENEFITS = [
  { value: "HIDRAT", label: "Hidratación" },
  { value: "SEBOCONT", label: "Control de Sebo" },
  { value: "ANTIAGE", label: "Anti-edad / Firmeza" },
  { value: "DESPIGM", label: "Despigmentante / Aclarador" },
  { value: "CALMANTE", label: "Calmante / Relajante" },
  { value: "PROTSOL", label: "Protección Solar" },
  { value: "ESTIMCAP", label: "Estimulación Capilar" },
  { value: "ALIVIO", label: "Alivio Rápido / Curativo" },
  { value: "LIMPIEZA", label: "Limpieza Profunda" },
  { value: "DESINFEC", label: "Desinfección / Antibacterial" },
  { value: "NUTRICION", label: "Nutrición / Alimentación" },
  { value: "REFRESCANTE", label: "Refrescante / Quita Sed" },
  { value: "AROMA", label: "Aromatizante / Perfumado" },
  { value: "ENTRETEN", label: "Entretenimiento / Social" },
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
