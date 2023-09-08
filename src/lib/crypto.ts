import CryptoJs from "crypto-js"

const { PUBSUB_ENCRYPT_KEY } = process.env

export function decryptString(text: string) {
  console.time("string-decrypt")
  const bytes = CryptoJs.AES.decrypt(text, PUBSUB_ENCRYPT_KEY!)

  console.timeEnd("string-decrypt")
  return bytes.toString(CryptoJs.enc.Utf8)
}
