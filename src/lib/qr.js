import QRCode from "qrcode"

// High error correction so a slightly damaged or dirty printout still scans
const OPTIONS = { errorCorrectionLevel: "H", margin: 2, color: { dark: "#000000", light: "#ffffff" } }

export function qrDataUrl(text, width = 320) {
  return QRCode.toDataURL(text, { ...OPTIONS, width })
}

export function qrPngBuffer(text, width = 1024) {
  return QRCode.toBuffer(text, { ...OPTIONS, type: "png", width })
}
