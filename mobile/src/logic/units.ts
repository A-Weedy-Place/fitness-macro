export function feetInchesToCm(feet: number, inches: number) {
  return (feet * 12 + inches) * 2.54;
}

export function cmToFeetInches(cm: number) {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: Number((totalInches - feet * 12).toFixed(1)) };
}

export function kgToLb(kg: number) {
  return kg * 2.2046226218;
}

export function lbToKg(lb: number) {
  return lb / 2.2046226218;
}
