import CryptoJs from "crypto-js"

const { ENCRYPT_KEY } = process.env

export function decryptString(text: string) {
  console.time("string-decrypt")
  const bytes = CryptoJs.AES.decrypt(text, ENCRYPT_KEY!)

  console.timeEnd("string-decrypt")
  return bytes.toString(CryptoJs.enc.Utf8)
}
