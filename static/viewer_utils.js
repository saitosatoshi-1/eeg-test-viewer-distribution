function preciseNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : 0;
}

function nkLabel(label) {
  const text = String(label || "");
  if (text === "E" || text === "X5") return "ECG";
  return text
    .replaceAll("T7", "T3")
    .replaceAll("T8", "T4")
    .replaceAll("P7", "T5")
    .replaceAll("P8", "T6");
}

function traceColor(trace, rowIndex, montage = activeMontageValue()) {
  if (trace.role === "ecg") return "#5f6762";
  if (montage === "conventional" || montage === "conventional_average") {
    const label = String(trace.label || "");
    if (/(^|-)Fz($|-)|(^|-)Cz($|-)|(^|-)Pz($|-)/.test(label)) return "#23734f";
    if (trace.group === "midline") return "#303030";
    if (trace.group === "left_temporal" || trace.group === "left_parasagittal") return "#1b3298";
    if (trace.group === "right_temporal" || trace.group === "right_parasagittal") return "#b4232d";
  }
  if (montage === "transverse") {
    if (trace.group?.startsWith("left_")) return "#344bc2";
    if (trace.group?.startsWith("right_")) return "#bf3f4c";
    return "#68706e";
  }
  if (trace.group === "left_temporal") return "#344bc2";
  if (trace.group === "right_temporal") return "#bf3f4c";
  if (trace.group === "left_parasagittal") return "#344bc2";
  if (trace.group === "right_parasagittal") return "#bf3f4c";
  if (trace.group === "midline") return "#23734f";
  if (montage === "a1a2") {
    if (rowIndex <= 3) return "#7880b8";
    if (rowIndex <= 7) return "#b84f57";
    if (rowIndex <= 11) return "#7880b8";
    if (rowIndex <= 15) return "#b84f57";
    if (rowIndex <= 17) return "#3f4542";
    return "#222";
  }
  if (rowIndex <= 3) return "#7880b8";
  if (rowIndex <= 7) return "#d18bd7";
  if (rowIndex <= 11) return "#8fc895";
  if (rowIndex <= 15) return "#c98286";
  if (rowIndex <= 17) return "#68706e";
  return "#222";
}

function formatSec(sec) {
  const mins = Math.floor(sec / 60);
  const s = sec - mins * 60;
  return `${String(mins).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

function formatHeaderTime(sec) {
  const mins = Math.floor(sec / 60);
  const s = Math.floor(sec - mins * 60);
  return `${mins}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
